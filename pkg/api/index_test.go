package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

type fakeNavTreeService struct {
	called bool
}

func (f *fakeNavTreeService) GetNavTree(_ *contextmodel.ReqContext, _ *pref.Preference) (*navtree.NavTreeRoot, error) {
	f.called = true
	return &navtree.NavTreeRoot{Children: []*navtree.NavLink{{Text: "Dashboards", Id: "dashboards"}}}, nil
}

// Installs a global in-memory OpenFeature provider so the package-level
// ofClient resolves the two client-nav-tree flags to the given values.
func setNavTreeFlags(t *testing.T, multiTenantNavTree, useMTPlugins bool) {
	t.Helper()
	boolFlag := func(key string, value bool) memprovider.InMemoryFlag {
		return memprovider.InMemoryFlag{
			Key:            key,
			DefaultVariant: "default",
			Variants:       map[string]any{"default": value},
		}
	}
	provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagGrafanaMultiTenantNavTree: boolFlag(featuremgmt.FlagGrafanaMultiTenantNavTree, multiTenantNavTree),
		featuremgmt.FlagPluginsUseMTPlugins:       boolFlag(featuremgmt.FlagPluginsUseMTPlugins, useMTPlugins),
	})
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() {
		require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{}))
	})
}

func TestIntegrationSetIndexViewData_clientNavTree(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	setup := func(t *testing.T) (*HTTPServer, *fakeNavTreeService, *contextmodel.ReqContext) {
		t.Helper()
		cfg := setting.NewCfg()
		// Dev bypasses the webassets package cache, so the fixture manifest
		// below is read regardless of what other tests have cached.
		cfg.Env = setting.Dev
		cfg.StaticRootPath = "webassets/testdata"
		cfg.DefaultTheme = "dark"

		_, hs := setupTestEnvironment(t, cfg, featuremgmt.WithFeatures(), nil, nil, nil)
		navService := &fakeNavTreeService{}
		hs.navTreeService = navService
		hs.preferenceService = &preftest.FakePreferenceService{
			ExpectedPreference: &pref.Preference{JSONData: &pref.PreferenceJSONData{}},
		}
		hs.HooksService = hooks.ProvideService()
		hs.orgService = &orgtest.FakeOrgService{}
		hs.accesscontrolService = accesscontrolmock.New()

		c := &contextmodel.ReqContext{
			Context:      &web.Context{Req: httptest.NewRequest(http.MethodGet, "/", nil)},
			SignedInUser: &user.SignedInUser{OrgID: 1},
			IsSignedIn:   true,
			Logger:       log.New("index-test"),
		}
		return hs, navService, c
	}

	tests := []struct {
		desc               string
		multiTenantNavTree bool
		useMTPlugins       bool
		expectSkip         bool
	}{
		{
			desc:               "builds the server nav tree when both flags are disabled",
			multiTenantNavTree: false,
			useMTPlugins:       false,
			expectSkip:         false,
		},
		{
			desc:               "builds the server nav tree when only grafana.multiTenantNavTree is enabled",
			multiTenantNavTree: true,
			useMTPlugins:       false,
			expectSkip:         false,
		},
		{
			desc:               "builds the server nav tree when only plugins.useMTPlugins is enabled",
			multiTenantNavTree: false,
			useMTPlugins:       true,
			expectSkip:         false,
		},
		{
			desc:               "skips building the server nav tree when both flags are enabled",
			multiTenantNavTree: true,
			useMTPlugins:       true,
			expectSkip:         true,
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			setNavTreeFlags(t, test.multiTenantNavTree, test.useMTPlugins)
			hs, navService, c := setup(t)

			data, err := hs.setIndexViewData(c)
			require.NoError(t, err)

			navTreeJSON, err := json.Marshal(data.NavTree)
			require.NoError(t, err)

			if test.expectSkip {
				assert.False(t, navService.called, "nav tree service should not be called when the client builds the tree")
				// Must serialise as an empty array, not null: frontends that
				// read bootData.navTree directly crash on null.
				assert.JSONEq(t, `[]`, string(navTreeJSON))
			} else {
				assert.True(t, navService.called, "nav tree service should build the tree")
				assert.Contains(t, string(navTreeJSON), "Dashboards")
			}
		})
	}
}
