package preferences

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationPreferences_Anonymous verifies that with the reroute flag on,
// anonymous requests are served through the app-platform preferences API: the
// merged route accepts the anonymous identity directly, and server-side
// consumers (index page, home dashboard) surface org preferences to anonymous
// visitors through it.
func TestIntegrationPreferences_Anonymous(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		DisableAnonymous:  false,          // keep [auth.anonymous] enabled = true (the harness default)
		AnonymousUserRole: org.RoleViewer, // anonymous lands in org 1 "Main Org."
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagPreferencesRerouteLegacyAPIs,
		},
	})

	// Seed org preferences as admin. The default theme is dark, so a light org
	// theme distinguishes "org preference applied" from "fell back to defaults".
	dash := struct {
		UID string `json:"uid"`
	}{}
	dashResp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPost,
		Path:   "/api/dashboards/db",
		Body:   []byte(`{"dashboard": {"title": "anon org home"}, "overwrite": true}`),
	}, &dash)
	require.Equal(t, http.StatusOK, dashResp.Response.StatusCode, string(dashResp.Body))
	require.NotEmpty(t, dash.UID)

	putResp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPut,
		Path:   "/api/org/preferences",
		Body:   fmt.Appendf(nil, `{"theme":"light","homeDashboardUID":%q}`, dash.UID),
	}, &map[string]any{})
	require.Equal(t, http.StatusOK, putResp.Response.StatusCode, string(putResp.Body))

	t.Run("merged route serves the anonymous identity", func(t *testing.T) {
		// No User -> the request is sent without credentials and is resolved
		// as the anonymous identity
		merged := preferences.Preferences{}
		resp := apis.DoRequest(helper, apis.RequestParams{
			Method: http.MethodGet,
			Path:   "/apis/preferences.grafana.app/v1/namespaces/default/preferences/merged",
		}, &merged)
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))

		require.NotNil(t, merged.Spec.Theme)
		require.Equal(t, "light", *merged.Spec.Theme, "org preference must reach anonymous requesters")
		require.Contains(t, merged.Annotations[preferences.APIGroup+"/source"], "namespace",
			"merged response must record the org preferences as a source")
	})

	t.Run("index page renders org preferences for anonymous visitors", func(t *testing.T) {
		// nolint:gosec
		resp, err := http.Get(fmt.Sprintf("http://%s/", helper.GetListenerAddress()))
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.True(t, strings.Contains(string(body), `"theme":"light"`),
			"anonymous index page must carry the org theme in its boot data")
	})

	t.Run("home dashboard endpoint reads org preferences for anonymous visitors", func(t *testing.T) {
		redirect := struct {
			RedirectURI string `json:"redirectUri"`
		}{}
		resp := apis.DoRequest(helper, apis.RequestParams{
			Method: http.MethodGet,
			Path:   "/api/dashboards/home",
		}, &redirect)
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
		require.Contains(t, redirect.RedirectURI, dash.UID,
			"home endpoint must redirect anonymous visitors to the org home dashboard")
	})
}
