package web

import (
	"bytes"
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
	"github.com/grafana/grafana/pkg/services/login/authinfoimpl"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// TestIntegrationIndexView tests the Grafana index view.
func TestIntegrationIndexView(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("CSP enabled", func(t *testing.T) {
		grafDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			EnableCSP: true,
		})

		addr, _ := testinfra.StartGrafana(t, grafDir, cfgPath)

		// nolint:bodyclose
		resp, html := makeRequest(t, addr, nil)
		assert.Regexp(t, `script-src 'self' 'unsafe-eval' 'unsafe-inline' 'strict-dynamic' 'nonce-[^']+';object-src 'none';font-src 'self';style-src 'self' 'unsafe-inline' blob:;img-src \* data:;base-uri 'self';connect-src 'self' grafana.com ws://localhost:3000/ wss://localhost:3000/;manifest-src 'self';media-src 'none';form-action 'self';`, resp.Header.Get("Content-Security-Policy"))
		assert.Regexp(t, `<script nonce="[^"]+"`, html)
	})

	t.Run("CSP disabled", func(t *testing.T) {
		grafDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			EnableCSP: false,
		})
		addr, _ := testinfra.StartGrafana(t, grafDir, cfgPath)

		// nolint:bodyclose
		resp, html := makeRequest(t, addr, nil)

		assert.Empty(t, resp.Header.Get("Content-Security-Policy"))
		assert.Regexp(t, `<script nonce=""`, html)
	})
}

func makeRequest(t *testing.T, addr string, session *http.Cookie) (*http.Response, string) {
	t.Helper()

	u := fmt.Sprintf("http://%s", addr)
	t.Logf("Making GET request to %s", u)

	request, err := http.NewRequest(http.MethodGet, u, nil)
	require.NoError(t, err)

	if session != nil {
		request.AddCookie(session)
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

func loginUser(t *testing.T, addr, username, password string) *http.Cookie {
	t.Helper()

	type body struct {
		Username string `json:"user"`
		Password string `json:"password"`
	}

	data, err := json.Marshal(&body{username, password})
	require.NoError(t, err)

	request, err := http.NewRequest(http.MethodPost, fmt.Sprintf("http://%s/login", addr), bytes.NewReader(data))
	require.NoError(t, err)
	request.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(request)
	require.NoError(t, err)
	require.NotNil(t, resp)
	t.Cleanup(func() {
		err := resp.Body.Close()
		assert.NoError(t, err)
	})

	require.Equal(t, 200, resp.StatusCode)

	var sessionCookie *http.Cookie
	for _, c := range resp.Cookies() {
		if c.Name == "grafana_session" {
			sessionCookie = c
		}
	}

	require.NotNil(t, sessionCookie)
	return sessionCookie
}

// TestIntegrationIndexViewAnalytics tests the Grafana index view has the analytics identifiers.
func TestIntegrationIndexViewAnalytics(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
			wantIdentifier: "test@grafana.com@http://localhost:3000/",
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

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			grafDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{})
			addr, env := testinfra.StartGrafanaEnv(t, grafDir, cfgPath)
			store := env.SQLStore
			createdUser := testinfra.CreateUser(t, store, env.Cfg, user.CreateUserCommand{
				Login:    "test",
				Password: "test",
				Email:    "test@grafana.com",
				OrgID:    1,
			})

			secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(store))
			authInfoStore := authinfoimpl.ProvideStore(store, secretsService)

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

			// perform login
			session := loginUser(t, addr, "test", "test")

			// nolint:bodyclose
			response, html := makeRequest(t, addr, session)
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
