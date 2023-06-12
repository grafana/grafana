package web

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/login"
	databaseAuthInfo "github.com/grafana/grafana/pkg/services/login/authinfoservice/database"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
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
	require.Equal(t, 200, resp.StatusCode, b.String())

	return resp, b.String()
}

// TestIntegrationIndexViewAnalytics tests the Grafana index view has the analytics identifiers.
func TestIntegrationIndexViewAnalytics(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	testCases := []struct {
		name           string
		authModule     string
		setID          string
		wantIdentifier string
		secondModule   string
		secondID       string
	}{
		{
			name:           "gcom only and last",
			authModule:     login.GrafanaComAuthModule,
			setID:          "test-id-oauth-grafana",
			wantIdentifier: "test-id-oauth-grafana",
		},
		{
			name:           "okta only and last",
			authModule:     login.OktaAuthModule,
			setID:          "uuid-1234-5678-9101",
			wantIdentifier: "admin@grafana.com@http://localhost:3000/",
		},
		{
			name:           "gcom last",
			authModule:     login.OktaAuthModule,
			setID:          "test-id-oauth-grafana",
			wantIdentifier: "60042",
			secondModule:   login.GrafanaComAuthModule,
			secondID:       "60042",
		},
	}

	// can be removed once ff is removed
	authBrokerStates := map[string]bool{"none": false, "authnService": true}

	for k, enabled := range authBrokerStates {
		for _, tc := range testCases {
			t.Run(tc.name+"-"+k, func(t *testing.T) {
				grafDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{AuthBrokerEnabled: enabled})
				addr, store := testinfra.StartGrafana(t, grafDir, cfgPath)
				createdUser := testinfra.CreateUser(t, store, user.CreateUserCommand{
					Login:    "admin",
					Password: "admin",
					Email:    "admin@grafana.com",
					OrgID:    1,
				})

				secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(store))
				authInfoStore := databaseAuthInfo.ProvideAuthInfoStore(store, secretsService, nil)

				// insert user_auth relationship
				err := authInfoStore.SetAuthInfo(context.Background(), &login.SetAuthInfoCommand{
					AuthModule: tc.authModule,
					AuthId:     tc.setID,
					UserId:     createdUser.ID,
				})
				require.NoError(t, err)
				if tc.secondModule != "" {
					// wait for the user_auth relationship to be inserted. TOFIX: this is a hack
					time.Sleep(1 * time.Second)
					err := authInfoStore.SetAuthInfo(context.Background(), &login.SetAuthInfoCommand{
						AuthModule: tc.secondModule,
						AuthId:     tc.secondID,
						UserId:     createdUser.ID,
					})
					require.NoError(t, err)
				}

				// nolint:bodyclose
				response, html := makeRequest(t, addr, "admin", "admin")
				assert.Equal(t, http.StatusOK, response.StatusCode)

				// parse User.Analytics HTML view into user.AnalyticsSettings model
				parsedHTML := strings.Split(html, "analytics\":")[1]
				parsedHTML = strings.Split(parsedHTML, "},\n")[0]

				var analyticsSettings user.AnalyticsSettings
				require.NoError(t, json.Unmarshal([]byte(parsedHTML), &analyticsSettings))

				require.NotEmpty(t, analyticsSettings.IntercomIdentifier)
				require.Equal(t, tc.wantIdentifier, analyticsSettings.Identifier)
			})
		}
	}
}
