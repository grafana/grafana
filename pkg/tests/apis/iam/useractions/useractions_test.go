package useractions

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

const (
	routePath       = "/apis/iam.grafana.app/v0alpha1/namespaces/default/userActions"
	legacyRoutePath = "/api/access-control/user/actions?reloadcache=true"
)

func TestIntegrationUserActions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagKubernetesUserActionsApi,
		},
	})
	t.Cleanup(helper.Shutdown)

	getUserActions := func(t *testing.T, user apis.User) map[string]bool {
		t.Helper()
		res := map[string]bool{}
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User: user,
			Path: routePath,
		}, &res)
		require.Equal(t, 200, rsp.Response.StatusCode)
		return res
	}

	getLegacyActions := func(t *testing.T, user apis.User) map[string]bool {
		t.Helper()
		res := map[string]bool{}
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User: user,
			Path: legacyRoutePath,
		}, &res)
		require.Equal(t, 200, rsp.Response.StatusCode)
		return res
	}

	t.Run("viewer gets read but not write actions", func(t *testing.T) {
		actions := getUserActions(t, helper.Org1.Viewer)
		require.True(t, actions["folders:read"])
		require.True(t, actions["annotations:read"])
		require.False(t, actions["dashboards:create"])
		require.False(t, actions["teams:create"])
	})

	t.Run("editor gets editor actions", func(t *testing.T) {
		actions := getUserActions(t, helper.Org1.Editor)
		require.True(t, actions["dashboards:create"])
		require.True(t, actions["folders:create"])
		require.False(t, actions["teams:create"])
	})

	t.Run("admin gets admin actions", func(t *testing.T) {
		actions := getUserActions(t, helper.Org1.Admin)
		require.True(t, actions["dashboards:create"])
		require.True(t, actions["teams:create"])
		require.True(t, actions["users:read"])
	})

	// Editor is a member of the helper's Staff team, which carries a managed
	// team permission. Viewer is not, so teams:read can only come from the
	// team assignment.
	t.Run("includes permissions granted through a team", func(t *testing.T) {
		require.True(t, getUserActions(t, helper.Org1.Editor)["teams:read"])
		require.False(t, getUserActions(t, helper.Org1.Viewer)["teams:read"])
	})

	// The endpoint must be a drop-in replacement for the legacy one, including
	// permissions that come from team membership. The helper puts Admin and
	// Editor in its Staff team, so those two exercise the team-derived path.
	t.Run("matches the legacy endpoint exactly", func(t *testing.T) {
		for name, user := range map[string]apis.User{
			"viewer": helper.Org1.Viewer,
			"editor": helper.Org1.Editor,
			"admin":  helper.Org1.Admin,
		} {
			t.Run(name, func(t *testing.T) {
				actions := getUserActions(t, user)
				require.NotEmpty(t, actions)
				require.Equal(t, getLegacyActions(t, user), actions)
			})
		}
	})

	// The frontend calls the legacy endpoint with reloadcache=true after mutating
	// its own permissions, so the same parameter has to bypass the cache here.
	t.Run("reloadcache returns a freshly resolved set", func(t *testing.T) {
		before := getUserActions(t, helper.Org1.Editor)

		res := map[string]bool{}
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User: helper.Org1.Editor,
			Path: routePath + "?reloadcache=true",
		}, &res)
		require.Equal(t, 200, rsp.Response.StatusCode)
		require.Equal(t, before, res)
	})

	t.Run("unauthenticated is rejected", func(t *testing.T) {
		res := map[string]any{}
		rsp := apis.DoRequest(helper, apis.RequestParams{
			Path: routePath,
		}, &res)
		require.Equal(t, 401, rsp.Response.StatusCode)
	})
}
