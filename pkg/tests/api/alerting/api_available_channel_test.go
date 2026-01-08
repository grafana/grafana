package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationAvailableChannels(t *testing.T) {
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

	t.Run("should return all available notifiers", func(t *testing.T) {
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/alert-notifiers", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(alertsURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		expectedBytes, err := os.ReadFile(path.Join("test-data", "alert-notifiers-v1-snapshot.json"))
		require.NoError(t, err)

		require.NoError(t, err)
		if !assert.JSONEq(t, string(expectedBytes), string(b)) {
			var prettyJSON bytes.Buffer
			err := json.Indent(&prettyJSON, b, "", "  ")
			require.NoError(t, err)
			err = os.WriteFile(path.Join("test-data", "alert-notifiers-v1-snapshot.json"), prettyJSON.Bytes(), 0o644)
			require.NoError(t, err)
		}
	})

	t.Run("should return versioned notifiers", func(t *testing.T) {
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/alert-notifiers?version=2", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(alertsURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		expectedBytes, err := os.ReadFile(path.Join("test-data", "alert-notifiers-v2-snapshot.json"))
		require.NoError(t, err)

		require.NoError(t, err)
		if !assert.JSONEq(t, string(expectedBytes), string(b)) {
			var prettyJSON bytes.Buffer
			err := json.Indent(&prettyJSON, b, "", "  ")
			require.NoError(t, err)
			err = os.WriteFile(path.Join("test-data", "alert-notifiers-v2-snapshot.json"), prettyJSON.Bytes(), 0o644)
			require.NoError(t, err)
		}
	})
}
