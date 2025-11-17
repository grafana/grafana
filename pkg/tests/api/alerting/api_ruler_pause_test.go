package alerting

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationAlertRulePauseNamespace(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Setup Grafana and its Database

	testinfra.SQLiteIntegrationTest(t)

	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)

	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Password:       "viewer",
		Login:          "viewer",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")
	viewerClient := newAlertingApiClient(grafanaListedAddr, "viewer", "viewer")

	// Create the folder we'll save our alerts to
	folderUID := util.GenerateShortUID()
	apiClient.CreateFolder(t, folderUID, "folder1")

	// Create multiple rule groups in the folder
	group1 := generateAlertRuleGroup(2, alertRuleGen())
	apiClient.PostRulesGroup(t, folderUID, &group1, false)
	group2 := generateAlertRuleGroup(3, alertRuleGen())
	apiClient.PostRulesGroup(t, folderUID, &group2, false)

	t.Run("pause all rules in namespace", func(t *testing.T) {
		req := &apimodels.UpdateNamespaceRulesRequest{
			IsPaused: util.Pointer(true),
		}
		response, status, _ := apiClient.UpdateNamespaceRules(t, folderUID, req)
		require.Equal(t, http.StatusAccepted, status)
		assert.Equal(t, "rules updated successfully", response.Message)

		// Verify all rules are now paused
		allRules, status, _ := apiClient.GetAllRulesWithStatus(t)
		require.Equal(t, http.StatusOK, status)
		for _, group := range allRules[folderUID] {
			for _, rule := range group.Rules {
				assert.True(t, rule.GrafanaManagedAlert.IsPaused, "Rule should be paused")
			}
		}
	})

	t.Run("unpause all rules in namespace", func(t *testing.T) {
		req := &apimodels.UpdateNamespaceRulesRequest{
			IsPaused: util.Pointer(false),
		}
		response, status, _ := apiClient.UpdateNamespaceRules(t, folderUID, req)
		require.Equal(t, http.StatusAccepted, status)
		assert.Equal(t, "rules updated successfully", response.Message)

		// Verify all rules are now unpaused
		allRules, status, _ := apiClient.GetAllRulesWithStatus(t)
		require.Equal(t, http.StatusOK, status)
		for _, group := range allRules[folderUID] {
			for _, rule := range group.Rules {
				assert.False(t, rule.GrafanaManagedAlert.IsPaused, "Rule should be unpaused")
			}
		}
	})

	t.Run("returns 403 for non-existent folder", func(t *testing.T) {
		req := &apimodels.UpdateNamespaceRulesRequest{
			IsPaused: util.Pointer(false),
		}
		_, status, _ := apiClient.UpdateNamespaceRules(t, "non-existent-folder", req)
		require.Equal(t, http.StatusForbidden, status)
	})

	t.Run("viewer cannot pause rules", func(t *testing.T) {
		req := &apimodels.UpdateNamespaceRulesRequest{
			IsPaused: util.Pointer(false),
		}
		_, status, _ := viewerClient.UpdateNamespaceRules(t, folderUID, req)
		require.Equal(t, http.StatusForbidden, status)
	})
}
