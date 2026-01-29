package alerting

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationReceiverSchemas(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testinfra.SQLiteIntegrationTest(t)

	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	t.Run("app platform api endpoint returns v2 schemas", func(t *testing.T) {
		// Test old endpoint with version=2
		oldReq, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://grafana:password@%s/api/alert-notifiers?version=2", grafanaListedAddr), nil)
		require.NoError(t, err)

		oldResp, err := http.DefaultClient.Do(oldReq)
		require.NoError(t, err)

		oldBody, err := io.ReadAll(oldResp.Body)
		require.NoError(t, oldResp.Body.Close())
		require.NoError(t, err)
		require.Equal(t, 200, oldResp.StatusCode)

		// Test new K8s API endpoint with version=2
		newReq, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://grafana:password@%s/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers/schema?version=2", grafanaListedAddr), nil)
		require.NoError(t, err)

		newResp, err := http.DefaultClient.Do(newReq)
		require.NoError(t, err)

		newBody, err := io.ReadAll(newResp.Body)
		require.NoError(t, newResp.Body.Close())
		require.NoError(t, err)
		require.Equal(t, 200, newResp.StatusCode)

		// Both should return the same data
		assert.JSONEq(t, string(oldBody), string(newBody),
			"K8s API endpoint should return same v2 format as legacy endpoint")

		// Verify we got an array of integration schemas
		var oldSchemas []map[string]interface{}
		err = json.Unmarshal(oldBody, &oldSchemas)
		require.NoError(t, err)
		assert.Greater(t, len(oldSchemas), 0, "Should return at least one integration schema")

		var newSchemas []map[string]interface{}
		err = json.Unmarshal(newBody, &newSchemas)
		require.NoError(t, err)
		assert.Equal(t, len(oldSchemas), len(newSchemas), "Both endpoints should return same number of schemas")
	})

	t.Run("app platform api endpoint requires authentication", func(t *testing.T) {
		// Test without authentication
		newReq, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://%s/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers/schema", grafanaListedAddr), nil)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(newReq)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())

		// Should return 401 Unauthorized
		assert.Equal(t, 401, resp.StatusCode, "Should require authentication")
	})

	t.Run("app platform api endpoint works with namespace path", func(t *testing.T) {
		// Note: The endpoint is namespace-scoped for API consistency with other
		// alerting notification endpoints, but the schema data itself is global
		// (same for all orgs). In a multi-tenant environment, all namespaces would
		// return identical schema data.

		// Test with "default" namespace
		req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://grafana:password@%s/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers/schema", grafanaListedAddr), nil)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, resp.Body.Close())
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		// Verify we got valid schema data
		var schemas []map[string]interface{}
		err = json.Unmarshal(body, &schemas)
		require.NoError(t, err)
		assert.Greater(t, len(schemas), 0, "Should return at least one schema")
	})

	t.Run("app platform api returns well-known integration types", func(t *testing.T) {
		newReq, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://grafana:password@%s/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers/schema", grafanaListedAddr), nil)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(newReq)
		require.NoError(t, err)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, resp.Body.Close())
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		var notifiers []map[string]interface{}
		err = json.Unmarshal(body, &notifiers)
		require.NoError(t, err)

		// Check for well-known integration types
		types := make(map[string]bool)
		for _, n := range notifiers {
			if t, ok := n["type"].(string); ok {
				types[t] = true
			}
		}

		// Verify common integration types are present
		assert.True(t, types["email"], "Should include email integration")
		assert.True(t, types["slack"], "Should include slack integration")
		assert.True(t, types["webhook"], "Should include webhook integration")
		assert.True(t, types["pagerduty"], "Should include pagerduty integration")
	})
}
