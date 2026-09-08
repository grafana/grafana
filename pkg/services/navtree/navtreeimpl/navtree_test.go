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
	newService := func(canReadDashboards bool) *ServiceImpl {
		return &ServiceImpl{
			cfg:           setting.NewCfg(),
			accessControl: actest.FakeAccessControl{ExpectedEvaluate: canReadDashboards},
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

	t.Run("Should show Notebooks for a signed-in user with dashboard read access when the flag is on", func(t *testing.T) {
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

	t.Run("Should not show Notebooks without dashboard read access", func(t *testing.T) {
		setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagDashboardNotebooks: true})

		require.Nil(t, newService(false).buildNotebooksNavLink(newReqCtx(true)))
	})

	t.Run("Should not show Notebooks for an unauthenticated user", func(t *testing.T) {
		setOpenFeatureFlags(t, map[string]bool{featuremgmt.FlagDashboardNotebooks: true})

		require.Nil(t, newService(true).buildNotebooksNavLink(newReqCtx(false)))
	})
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
	if alertNav == nil {
		return false
	}
	for _, link := range alertNav.Children {
		if link.Id == "alerts-history" {
			return true
		}
	}
	return false
}
