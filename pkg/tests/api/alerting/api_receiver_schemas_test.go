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

	t.Run("K8s API endpoint should return same data as legacy endpoint (v1 format)", func(t *testing.T) {
		// Test old endpoint
		oldURL := fmt.Sprintf("http://grafana:password@%s/api/alert-notifiers", grafanaListedAddr)
		oldResp, err := http.Get(oldURL)
		require.NoError(t, err)
		defer oldResp.Body.Close()

		oldBody, err := io.ReadAll(oldResp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, oldResp.StatusCode)

		// Test new K8s API endpoint
		// Using "default" as namespace - in Grafana this maps to the default org
		newURL := fmt.Sprintf("http://grafana:password@%s/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers/schema", grafanaListedAddr)
		newResp, err := http.Get(newURL)
		require.NoError(t, err)
		defer newResp.Body.Close()

		newBody, err := io.ReadAll(newResp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, newResp.StatusCode)

		// Both should return the same data
		assert.JSONEq(t, string(oldBody), string(newBody),
			"K8s API endpoint should return same v1 format as legacy endpoint")

		// Verify we got an array of notifiers
		var oldNotifiers []map[string]interface{}
		err = json.Unmarshal(oldBody, &oldNotifiers)
		require.NoError(t, err)
		assert.Greater(t, len(oldNotifiers), 0, "Should return at least one notifier")

		var newNotifiers []map[string]interface{}
		err = json.Unmarshal(newBody, &newNotifiers)
		require.NoError(t, err)
		assert.Equal(t, len(oldNotifiers), len(newNotifiers), "Both endpoints should return same number of notifiers")
	})

	t.Run("K8s API endpoint should return same data as legacy endpoint (v2 format)", func(t *testing.T) {
		// Test old endpoint with version=2
		oldURL := fmt.Sprintf("http://grafana:password@%s/api/alert-notifiers?version=2", grafanaListedAddr)
		oldResp, err := http.Get(oldURL)
		require.NoError(t, err)
		defer oldResp.Body.Close()

		oldBody, err := io.ReadAll(oldResp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, oldResp.StatusCode)

		// Test new K8s API endpoint with version=2
		newURL := fmt.Sprintf("http://grafana:password@%s/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers/schema?version=2", grafanaListedAddr)
		newResp, err := http.Get(newURL)
		require.NoError(t, err)
		defer newResp.Body.Close()

		newBody, err := io.ReadAll(newResp.Body)
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

	t.Run("K8s API endpoint requires authentication", func(t *testing.T) {
		// Test without authentication
		newURL := fmt.Sprintf("http://%s/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers/schema", grafanaListedAddr)
		resp, err := http.Get(newURL)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Should return 401 Unauthorized
		assert.Equal(t, 401, resp.StatusCode, "Should require authentication")
	})

	t.Run("K8s API endpoint works with namespace path", func(t *testing.T) {
		// Note: The endpoint is namespace-scoped for API consistency with other
		// alerting notification endpoints, but the schema data itself is global
		// (same for all orgs). In a multi-tenant environment, all namespaces would
		// return identical schema data.

		// Test with "default" namespace
		url := fmt.Sprintf("http://grafana:password@%s/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers/schema", grafanaListedAddr)
		resp, err := http.Get(url)
		require.NoError(t, err)
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		// Verify we got valid schema data
		var schemas []map[string]interface{}
		err = json.Unmarshal(body, &schemas)
		require.NoError(t, err)
		assert.Greater(t, len(schemas), 0, "Should return at least one schema")
	})

	t.Run("K8s API returns well-known integration types", func(t *testing.T) {
		newURL := fmt.Sprintf("http://grafana:password@%s/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers/schema", grafanaListedAddr)
		resp, err := http.Get(newURL)
		require.NoError(t, err)
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
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
