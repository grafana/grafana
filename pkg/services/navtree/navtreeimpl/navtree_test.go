package navtreeimpl

import (
	"net/http"
	"sync"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/notebooks"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestGetAdminNode_ProvisioningLink(t *testing.T) {
	newService := func(provisioningEnabled bool) ServiceImpl {
		cfg := setting.NewCfg()
		cfg.ProvisioningEnabled = provisioningEnabled

		lic := licensingtest.NewFakeLicensing()
		lic.On("FeatureEnabled", mock.Anything).Return(false)

		return ServiceImpl{
			cfg:           cfg,
			accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
			authnService:  &authntest.FakeService{ExpectedIdentity: &authn.Identity{}},
			license:       lic,
			features:      featuremgmt.WithFeatures(),
		}
	}

	newAdminReqCtx := func() *contextmodel.ReqContext {
		httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
		return &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{OrgRole: org.RoleAdmin},
			IsSignedIn:   true,
			Context:      &web.Context{Req: httpReq},
		}
	}

	hasProvisioningLink := func(node *navtree.NavLink) bool {
		for _, section := range node.Children {
			for _, link := range section.Children {
				if link.Id == "provisioning" {
					return true
				}
			}
		}
		return false
	}

	t.Run("shows provisioning link when enabled", func(t *testing.T) {
		svc := newService(true)
		node, err := svc.getAdminNode(newAdminReqCtx())
		require.NoError(t, err)
		require.True(t, hasProvisioningLink(node))
	})

	t.Run("hides provisioning link when disabled", func(t *testing.T) {
		svc := newService(false)
		node, err := svc.getAdminNode(newAdminReqCtx())
		require.NoError(t, err)
		require.False(t, hasProvisioningLink(node))
	})
}

func TestBuildDashboardNavLinks(t *testing.T) {
	newService := func() ServiceImpl {
		return ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
			features:      featuremgmt.WithFeatures(),
		}
	}

	hasPlaylistLink := func(navLinks []*navtree.NavLink) bool {
		for _, link := range navLinks {
			if link.Id == "dashboards/playlists" {
				return true
			}
		}
		return false
	}

	t.Run("Should show Playlists link for an anonymous Viewer", func(t *testing.T) {
		httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
		reqCtx := &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{
				IsAnonymous: true,
				OrgRole:     org.RoleViewer,
			},
			IsSignedIn: false,
			Context:    &web.Context{Req: httpReq},
		}

		service := newService()
		navLinks := service.buildDashboardNavLinks(reqCtx)

		require.True(t, hasPlaylistLink(navLinks), "expected anonymous Viewer to see the Playlists nav link")
	})

	t.Run("Should not show Playlists link for an unauthenticated user", func(t *testing.T) {
		httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
		reqCtx := &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{
				IsAnonymous: false,
				OrgRole:     org.RoleViewer,
			},
			IsSignedIn: false,
			Context:    &web.Context{Req: httpReq},
		}

		service := newService()
		navLinks := service.buildDashboardNavLinks(reqCtx)

		require.False(t, hasPlaylistLink(navLinks), "expected unauthenticated user to not see the Playlists nav link")
	})
}

// openfeatureTestMutex serializes tests that swap the global OpenFeature provider.
var openfeatureTestMutex sync.Mutex

func setOpenFeatureFlags(t *testing.T, flags map[string]bool) {
	t.Helper()
	openfeatureTestMutex.Lock()
	// Registered before anything that can FailNow, so a failed assertion below cannot leave the
	// mutex locked and deadlock the rest of the package.
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMutex.Unlock()
	})

	inMem := make(map[string]memprovider.InMemoryFlag, len(flags))
	for name, value := range flags {
		inMem[name] = setting.NewInMemoryFlag(name, value)
	}
	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(inMem)
	require.NoError(t, err)
	require.NoError(t, openfeature.SetProviderAndWait(provider))
}

func TestBuildNotebooksNavLink(t *testing.T) {
	newService := func(canReadNotebooks bool) *ServiceImpl {
		return &ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: actest.FakeAccessControl{ExpectedEvaluate: canReadNotebooks},
			features:      featuremgmt.WithFeatures(),
		}
	}

	newReqCtx := func(isSignedIn bool) *contextmodel.ReqContext {
		httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
		return &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{OrgRole: org.RoleViewer},
			IsSignedIn:   isSignedIn,
			Context:      &web.Context{Req: httpReq},
		}
	}

	t.Run("Should show Notebooks for a signed-in user with notebook read access when the flag is on", func(t *testing.T) {
		setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagDashboardNotebooks: true})

		link := newService(true).buildNotebooksNavLink(newReqCtx(true))

		require.NotNil(t, link)
		require.Equal(t, navtree.NavIDNotebooks, link.Id)
		require.Equal(t, "/notebooks", link.Url)
	})

	t.Run("Should not show Notebooks when the flag is off", func(t *testing.T) {
		setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagDashboardNotebooks: false})

		require.Nil(t, newService(true).buildNotebooksNavLink(newReqCtx(true)))
	})

	t.Run("Should not show Notebooks without notebook read access", func(t *testing.T) {
		setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagDashboardNotebooks: true})

		require.Nil(t, newService(false).buildNotebooksNavLink(newReqCtx(true)))
	})

	t.Run("Should not show Notebooks for an unauthenticated user", func(t *testing.T) {
		setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagDashboardNotebooks: true})

		require.Nil(t, newService(true).buildNotebooksNavLink(newReqCtx(false)))
	})

	for _, testCase := range []struct {
		name        string
		permissions []ac.Permission
		wantSection bool
		wantCreate  bool
	}{
		{
			name:        "reader has no create action",
			permissions: []ac.Permission{{Action: notebooks.ActionNotebooksRead}},
			wantSection: true,
		},
		{
			name:        "creator has a create action",
			permissions: []ac.Permission{{Action: notebooks.ActionNotebooksRead}, {Action: notebooks.ActionNotebooksCreate}},
			wantSection: true,
			wantCreate:  true,
		},
		{
			name:        "create permission alone does not expose the section",
			permissions: []ac.Permission{{Action: notebooks.ActionNotebooksCreate}},
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagDashboardNotebooks: true})
			cfg := setting.NewCfg()
			cfg.AppSubURL = "/grafana"
			service := &ServiceImpl{
				cfg:           cfg,
				accessControl: accesscontrolmock.New().WithPermissions(testCase.permissions),
				features:      featuremgmt.WithFeatures(),
			}
			link := service.buildNotebooksNavLink(newReqCtx(true))
			if !testCase.wantSection {
				require.Nil(t, link)
				return
			}
			require.NotNil(t, link)
			require.Equal(t, "/grafana/notebooks", link.Url)
			if !testCase.wantCreate {
				require.Empty(t, link.Children)
				return
			}
			require.Equal(t, []*navtree.NavLink{{
				Text: "New notebook", Id: "notebooks/new", Icon: "plus",
				Url: "/grafana/notebooks/new?edit=true", HideFromTabs: true, IsCreateAction: true,
			}}, link.Children)
		})
	}
}

func TestBuildAlertNavLinks(t *testing.T) {
	ruleReadPermission := []ac.Permission{{Action: ac.ActionAlertingRuleRead, Scope: "*"}}

	testCases := []struct {
		name            string
		stateHistory    setting.UnifiedAlertingStateHistorySettings
		permissions     []ac.Permission
		expectedVisible bool
	}{
		{
			name:            "annotations backend cannot serve the history page",
			stateHistory:    setting.UnifiedAlertingStateHistorySettings{Enabled: true, Backend: "annotations"},
			permissions:     ruleReadPermission,
			expectedVisible: false,
		},
		{
			name:            "loki backend serves the history page",
			stateHistory:    setting.UnifiedAlertingStateHistorySettings{Enabled: true, Backend: "loki"},
			permissions:     ruleReadPermission,
			expectedVisible: true,
		},
		{
			name:            "multiple backend with loki as primary serves the history page",
			stateHistory:    setting.UnifiedAlertingStateHistorySettings{Enabled: true, Backend: "multiple", MultiPrimary: "loki"},
			permissions:     ruleReadPermission,
			expectedVisible: true,
		},
		{
			name:            "multiple backend with annotations as primary cannot serve the history page",
			stateHistory:    setting.UnifiedAlertingStateHistorySettings{Enabled: true, Backend: "multiple", MultiPrimary: "annotations"},
			permissions:     ruleReadPermission,
			expectedVisible: false,
		},
		{
			name:            "disabled state history has nothing to show",
			stateHistory:    setting.UnifiedAlertingStateHistorySettings{Enabled: false, Backend: "loki"},
			permissions:     ruleReadPermission,
			expectedVisible: false,
		},
		{
			name:            "user without rule read permission does not see the history page",
			stateHistory:    setting.UnifiedAlertingStateHistorySettings{Enabled: true, Backend: "loki"},
			permissions:     nil,
			expectedVisible: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.UnifiedAlerting.StateHistory = tc.stateHistory

			service := ServiceImpl{
				cfg:           cfg,
				accessControl: accesscontrolmock.New().WithPermissions(tc.permissions),
				features:      featuremgmt.WithFeatures(),
			}

			httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
			reqCtx := &contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{OrgRole: org.RoleViewer},
				IsSignedIn:   true,
				Context:      &web.Context{Req: httpReq},
			}

			alertNav := service.buildAlertNavLinks(reqCtx)

			require.Equal(t, tc.expectedVisible, hasHistoryLink(alertNav), "unexpected visibility of the alert history nav link")
		})
	}
}

func hasHistoryLink(alertNav *navtree.NavLink) bool {
	return findChildLink(alertNav, "alerts-history") != nil
}

func TestBuildAlertNavLinks_RecentlyDeleted(t *testing.T) {
	testCases := []struct {
		name            string
		role            org.RoleType
		features        []any
		expectedVisible bool
	}{
		{
			name:            "admin sees the page",
			role:            org.RoleAdmin,
			expectedVisible: true,
		},
		{
			name:            "editor does not see the page",
			role:            org.RoleEditor,
			expectedVisible: false,
		},
		{
			name:            "navigation V2 shows the page as a tab instead",
			role:            org.RoleAdmin,
			features:        []any{featuremgmt.FlagAlertingNavigationV2},
			expectedVisible: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			service := ServiceImpl{
				cfg:           setting.NewCfg(),
				accessControl: accesscontrolmock.New(),
				features:      featuremgmt.WithFeatures(tc.features...),
			}

			httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
			reqCtx := &contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{OrgRole: tc.role},
				IsSignedIn:   true,
				Context:      &web.Context{Req: httpReq},
			}

			link := findChildLink(service.buildAlertNavLinks(reqCtx), "alerts/recently-deleted")

			require.Equal(t, tc.expectedVisible, link != nil, "unexpected visibility of the recently deleted nav link")
		})
	}
}

func TestBuildAlertNavLinks_AlertActivity(t *testing.T) {
	prometheusStateHistory := setting.UnifiedAlertingStateHistorySettings{Enabled: true, Backend: "prometheus", PrometheusTargetDatasourceUID: "prom-uid"}
	permissions := []ac.Permission{
		{Action: ac.ActionAlertingRuleRead, Scope: "*"},
		{Action: ac.ActionAlertingInstanceRead, Scope: "*"},
	}

	testCases := []struct {
		name               string
		stateHistory       setting.UnifiedAlertingStateHistorySettings
		features           []any
		expectedActivityID string
		expectedGroups     bool
	}{
		{
			name:               "shown when state history writes to prometheus",
			stateHistory:       prometheusStateHistory,
			features:           []any{featuremgmt.FlagAlertingTriage},
			expectedActivityID: "alert-alerts",
			expectedGroups:     true,
		},
		{
			// Grafana Cloud: a separate ruler service writes the metrics, this Grafana only writes to Loki
			name:               "shown when a target data source is set with the loki backend",
			stateHistory:       setting.UnifiedAlertingStateHistorySettings{Enabled: true, Backend: "loki", PrometheusTargetDatasourceUID: "prom-uid"},
			features:           []any{featuremgmt.FlagAlertingTriage},
			expectedActivityID: "alert-alerts",
			expectedGroups:     true,
		},
		{
			name:               "hidden when no target data source is set",
			stateHistory:       setting.UnifiedAlertingStateHistorySettings{Enabled: true, Backend: "loki"},
			features:           []any{featuremgmt.FlagAlertingTriage},
			expectedActivityID: "",
			expectedGroups:     true,
		},
		{
			name:               "hidden when the feature flag is turned off",
			stateHistory:       prometheusStateHistory,
			features:           nil,
			expectedActivityID: "",
			expectedGroups:     true,
		},
		{
			name:               "navigation V2 moves alert groups into a tab of alert activity",
			stateHistory:       prometheusStateHistory,
			features:           []any{featuremgmt.FlagAlertingTriage, featuremgmt.FlagAlertingNavigationV2},
			expectedActivityID: "alert-activity",
			expectedGroups:     false,
		},
		{
			name:               "navigation V2 keeps alert groups when alert activity is unavailable",
			stateHistory:       setting.UnifiedAlertingStateHistorySettings{Enabled: true, Backend: "annotations"},
			features:           []any{featuremgmt.FlagAlertingTriage, featuremgmt.FlagAlertingNavigationV2},
			expectedActivityID: "",
			expectedGroups:     true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.UnifiedAlerting.StateHistory = tc.stateHistory

			service := ServiceImpl{
				cfg:           cfg,
				accessControl: accesscontrolmock.New().WithPermissions(permissions),
				features:      featuremgmt.WithFeatures(tc.features...),
			}

			httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
			reqCtx := &contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{OrgRole: org.RoleViewer},
				IsSignedIn:   true,
				Context:      &web.Context{Req: httpReq},
			}

			alertNav := service.buildAlertNavLinks(reqCtx)

			for _, id := range []string{"alert-alerts", "alert-activity"} {
				require.Equal(t, id == tc.expectedActivityID, findChildLink(alertNav, id) != nil, "unexpected visibility of the %q nav link", id)
			}
			require.Equal(t, tc.expectedGroups, findChildLink(alertNav, "groups") != nil, "unexpected visibility of the alert groups nav link")
		})
	}
}

func findChildLink(nav *navtree.NavLink, id string) *navtree.NavLink {
	if nav == nil {
		return nil
	}
	for _, link := range nav.Children {
		if link.Id == id {
			return link
		}
	}
	return nil
}

func TestBuildAlertNavLinks_GmaOnlyListView(t *testing.T) {
	ruleReadPermission := []ac.Permission{{Action: ac.ActionAlertingRuleRead, Scope: "*"}}

	newReqCtx := func(role org.RoleType) *contextmodel.ReqContext {
		httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
		return &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{OrgRole: role},
			IsSignedIn:   true,
			Context:      &web.Context{Req: httpReq},
		}
	}

	t.Run("flag off keeps the combined Alert rules entry and legacy Recently deleted", func(t *testing.T) {
		setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagAlertingGmaOnlyListView: false})

		service := ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions(ruleReadPermission),
			features:      featuremgmt.WithFeatures(featuremgmt.FlagAlertRuleRestore, featuremgmt.FlagAlertingRuleRecoverDeleted),
		}

		alertNav := service.buildAlertNavLinks(newReqCtx(org.RoleAdmin))

		require.NotNil(t, findChildLink(alertNav, "alert-list"), "expected the legacy combined Alert rules entry")
		require.Nil(t, findChildLink(alertNav, "alert-rules"))
		require.Nil(t, findChildLink(alertNav, "recording-rules"))
		require.NotNil(t, findChildLink(alertNav, "alerts/recently-deleted"), "expected the legacy standalone Recently deleted entry")
	})

	t.Run("flag on replaces Alert rules with peer Alert/Recording entries and drops the combined Recently deleted entry", func(t *testing.T) {
		setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagAlertingGmaOnlyListView: true})

		service := ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions(ruleReadPermission),
			features:      featuremgmt.WithFeatures(featuremgmt.FlagAlertRuleRestore, featuremgmt.FlagAlertingRuleRecoverDeleted),
		}

		alertNav := service.buildAlertNavLinks(newReqCtx(org.RoleAdmin))

		require.Nil(t, findChildLink(alertNav, "alert-list"))
		require.Nil(t, findChildLink(alertNav, "alerts/recently-deleted"), "the combined Recently deleted entry must not appear once gmaOnlyListView is on")

		alertRulesLink := findChildLink(alertNav, "alert-rules")
		require.NotNil(t, alertRulesLink, "expected a peer Alert rules entry")
		require.Equal(t, "/alerting/rules/alert", alertRulesLink.Url)

		recordingRulesLink := findChildLink(alertNav, "recording-rules")
		require.NotNil(t, recordingRulesLink, "expected a peer Recording rules entry")
		require.Equal(t, "/alerting/rules/recording", recordingRulesLink.Url)
	})

	t.Run("flag on gives the same peer entries when alertingNavigationV2 is enabled", func(t *testing.T) {
		setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagAlertingGmaOnlyListView: true})

		service := ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions(ruleReadPermission),
			features:      featuremgmt.WithFeatures(featuremgmt.FlagAlertingNavigationV2),
		}

		alertNav := service.buildAlertNavLinks(newReqCtx(org.RoleAdmin))

		require.Nil(t, findChildLink(alertNav, "alert-list"))
		require.Nil(t, findChildLink(alertNav, "alerts/recently-deleted"))
		require.Equal(t, "/alerting/rules/alert", findChildLink(alertNav, "alert-rules").Url)
		require.Equal(t, "/alerting/rules/recording", findChildLink(alertNav, "recording-rules").Url)
	})

	t.Run("flag on with only data source-managed read permission shows neither entry", func(t *testing.T) {
		setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagAlertingGmaOnlyListView: true})

		service := ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions([]ac.Permission{{Action: ac.ActionAlertingRuleExternalRead, Scope: "*"}}),
			features:      featuremgmt.WithFeatures(),
		}

		alertNav := service.buildAlertNavLinks(newReqCtx(org.RoleViewer))

		require.Nil(t, findChildLink(alertNav, "alert-rules"))
		require.Nil(t, findChildLink(alertNav, "recording-rules"))
	})

	t.Run("flag on without Grafana-managed read permission shows neither entry", func(t *testing.T) {
		setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagAlertingGmaOnlyListView: true})

		service := ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions(nil),
			features:      featuremgmt.WithFeatures(),
		}

		alertNav := service.buildAlertNavLinks(newReqCtx(org.RoleViewer))

		require.Nil(t, findChildLink(alertNav, "alert-rules"))
		require.Nil(t, findChildLink(alertNav, "recording-rules"))
	})
}
