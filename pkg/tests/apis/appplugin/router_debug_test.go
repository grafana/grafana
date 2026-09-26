package appplugin

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationRouterDebugInMiddlewareMode(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := setupHelperWithManifest(t, rest.Mode5, featuremgmt.FlagGrafanaUseRouterMiddleware)

	type debugGroup struct {
		Group  string `json:"group"`
		Source string `json:"source"`
	}
	var state struct {
		Groups []debugGroup `json:"groups"`
	}
	rsp := apis.DoRequest(helper, apis.RequestParams{User: helper.Org1.Admin, Path: "/debug/router"}, &state)
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, string(rsp.Body))
	require.Contains(t, state.Groups, debugGroup{Group: testAppGroup, Source: "local-plugin"})

	// Grafana refuses non-admins; for a non-API path it redirects rather than
	// answering 403. Either way none of the router's state is returned.
	rsp = apis.DoRequest(helper, apis.RequestParams{User: helper.Org1.Viewer, Path: "/debug/router"}, &state)
	require.NotEqual(t, http.StatusOK, rsp.Response.StatusCode, "only server admins may read the router's state")
	require.NotContains(t, string(rsp.Body), testAppGroup)
}
