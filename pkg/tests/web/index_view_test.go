package web

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// TestIntegrationIndexView tests the Grafana index view.
func TestIntegrationIndexView(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("CSP enabled", func(t *testing.T) {
		grafDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			EnableCSP: true,
		})

		addr, _ := testinfra.StartGrafana(t, grafDir, cfgPath)

		// nolint:bodyclose
		resp, html := makeRequest(t, addr, "", "")
		assert.Regexp(t, `script-src 'self' 'unsafe-eval' 'unsafe-inline' 'strict-dynamic' 'nonce-[^']+';object-src 'none';font-src 'self';style-src 'self' 'unsafe-inline' blob:;img-src \* data:;base-uri 'self';connect-src 'self' grafana.com ws://localhost:3000/ wss://localhost:3000/;manifest-src 'self';media-src 'none';form-action 'self';`, resp.Header.Get("Content-Security-Policy"))
		assert.Regexp(t, `<script nonce="[^"]+"`, html)
	})

	t.Run("CSP disabled", func(t *testing.T) {
		grafDir, cfgPath := testinfra.CreateGrafDir(t)
		addr, _ := testinfra.StartGrafana(t, grafDir, cfgPath)

		// nolint:bodyclose
		resp, html := makeRequest(t, addr, "", "")

		assert.Empty(t, resp.Header.Get("Content-Security-Policy"))
		assert.Regexp(t, `<script nonce=""`, html)
	})

	t.Run("Test the exposed user data contains the analytics identifiers", func(t *testing.T) {
		grafDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			EnableFeatureToggles: []string{"authnService"},
		})

		addr, store := testinfra.StartGrafana(t, grafDir, cfgPath)
		createdUser := testinfra.CreateUser(t, store, user.CreateUserCommand{
			Login:    "admin",
			Password: "admin",
			Email:    "admin@grafana.com",
			OrgID:    1,
		})

		// insert user_auth relationship
		queryString := "INSERT INTO \"main\".\"user_auth\" (\"id\", \"user_id\", \"auth_module\", \"auth_id\", \"created\", \"o_auth_access_token\", \"o_auth_refresh_token\", \"o_auth_token_type\", \"o_auth_expiry\", \"o_auth_id_token\") VALUES (\"1\", \"%d\", \"oauth_grafana_com\", \"test-id-oauth-grafana\", \"2023-03-13 14:08:11\", \"\", \"\", \"\", \"\", \"\");"
		query := fmt.Sprintf(queryString, createdUser.ID)
		_, err := store.GetEngine().Exec(query)
		require.NoError(t, err)

		// nolint:bodyclose
		response, html := makeRequest(t, addr, "admin", "admin")
		assert.Equal(t, 200, response.StatusCode)

		// parse User.Analytics HTML view into user.AnalyticsSettings model
		parsedHTML := strings.Split(html, "analytics\":")[1]
		parsedHTML = strings.Split(parsedHTML, "},\n")[0]

		var analyticsSettings user.AnalyticsSettings
		require.NoError(t, json.Unmarshal([]byte(parsedHTML), &analyticsSettings))

		require.Equal(t, "test-id-oauth-grafana", analyticsSettings.Identifier)
	})
}

func makeRequest(t *testing.T, addr, username, passwowrd string) (*http.Response, string) {
	t.Helper()

	u := fmt.Sprintf("http://%s", addr)
	t.Logf("Making GET request to %s", u)

	request, err := http.NewRequest("GET", u, nil)
	require.NoError(t, err)

	if username != "" && passwowrd != "" {
		request.SetBasicAuth(username, passwowrd)
	}

	resp, err := http.DefaultClient.Do(request)
	require.NoError(t, err)
	require.NotNil(t, resp)
	t.Cleanup(func() {
		err := resp.Body.Close()
		assert.NoError(t, err)
	})

	var b strings.Builder
	_, err = io.Copy(&b, resp.Body)
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	return resp, b.String()
}
