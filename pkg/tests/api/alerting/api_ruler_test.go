package alerting

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"path"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/datasources"
	datasourceService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
)

//go:embed test-data/*.*
var testData embed.FS

func TestIntegrationAlertRulePermissions(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)
	permissionsStore := resourcepermissions.NewStore(env.Cfg, env.SQLStore, featuremgmt.WithFeatures())

	// Create a user to make authenticated requests
	userID := createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder1", "folder1")
	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder2", "folder2")

	postGroupRaw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1-post.json"))
	require.NoError(t, err)
	var group1 apimodels.PostableRuleGroupConfig
	require.NoError(t, json.Unmarshal(postGroupRaw, &group1))

	// Create rule under folder1
	_, status, response := apiClient.PostRulesGroupWithStatus(t, "folder1", &group1)
	require.Equalf(t, http.StatusAccepted, status, response)

	postGroupRaw, err = testData.ReadFile(path.Join("test-data", "rulegroup-2-post.json"))
	require.NoError(t, err)
	var group2 apimodels.PostableRuleGroupConfig
	require.NoError(t, json.Unmarshal(postGroupRaw, &group2))

	// Create rule under folder2
	_, status, response = apiClient.PostRulesGroupWithStatus(t, "folder2", &group2)
	require.Equalf(t, http.StatusAccepted, status, response)

	// With the rules created, let's make sure that rule definitions are stored.
	allRules, status, _ := apiClient.GetAllRulesWithStatus(t)
	require.Equal(t, http.StatusOK, status)
	status, allExportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
		ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
	})
	require.Equal(t, http.StatusOK, status)
	var allExport apimodels.AlertingFileExport
	require.NoError(t, json.Unmarshal([]byte(allExportRaw), &allExport))

	t.Run("when user has all permissions", func(t *testing.T) {
		t.Run("Get all returns all rules", func(t *testing.T) {
			var group1, group2 apimodels.GettableRuleGroupConfig

			getGroup1Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1-get.json"))
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(getGroup1Raw, &group1))
			getGroup2Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-2-get.json"))
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(getGroup2Raw, &group2))

			expected := apimodels.NamespaceConfigResponse{
				"folder1": []apimodels.GettableRuleGroupConfig{
					group1,
				},
				"folder2": []apimodels.GettableRuleGroupConfig{
					group2,
				},
			}

			pathsToIgnore := []string{
				"GrafanaManagedAlert.Updated",
				"GrafanaManagedAlert.UID",
				"GrafanaManagedAlert.ID",
				"GrafanaManagedAlert.Data.Model",
				"GrafanaManagedAlert.NamespaceUID",
				"GrafanaManagedAlert.NamespaceID",
			}

			// compare expected and actual and ignore the dynamic fields
			diff := cmp.Diff(expected, allRules, cmp.FilterPath(func(path cmp.Path) bool {
				for _, s := range pathsToIgnore {
					if strings.Contains(path.String(), s) {
						return true
					}
				}
				return false
			}, cmp.Ignore()))

			require.Empty(t, diff)

			for _, rule := range allRules["folder1"][0].Rules {
				assert.Equal(t, "folder1", rule.GrafanaManagedAlert.NamespaceUID)
			}
			for _, rule := range allRules["folder2"][0].Rules {
				assert.Equal(t, "folder2", rule.GrafanaManagedAlert.NamespaceUID)
			}
		})

		t.Run("Get by folder returns groups in folder", func(t *testing.T) {
			rules, status, _ := apiClient.GetAllRulesGroupInFolderWithStatus(t, "folder1")
			require.Equal(t, http.StatusAccepted, status)
			require.Contains(t, rules, "folder1")
			require.Len(t, rules["folder1"], 1)
			require.Equal(t, allRules["folder1"], rules["folder1"])
		})

		t.Run("Get group returns a single group", func(t *testing.T) {
			rules := apiClient.GetRulesGroup(t, "folder2", allRules["folder2"][0].Name)
			cmp.Diff(allRules["folder2"][0], rules.GettableRuleGroupConfig)
		})

		t.Run("Export returns all rules", func(t *testing.T) {
			var group1File, group2File apimodels.AlertingFileExport
			getGroup1Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1-export.json"))
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(getGroup1Raw, &group1File))
			getGroup2Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-2-export.json"))
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(getGroup2Raw, &group2File))

			group1File.Groups = append(group1File.Groups, group2File.Groups...)
			expected := group1File

			pathsToIgnore := []string{
				"Groups.Rules.UID",
				"Groups.Folder",
			}

			// compare expected and actual and ignore the dynamic fields
			diff := cmp.Diff(expected, allExport, cmp.FilterPath(func(path cmp.Path) bool {
				for _, s := range pathsToIgnore {
					if strings.Contains(path.String(), s) {
						return true
					}
				}
				return false
			}, cmp.Ignore()))

			require.Empty(t, diff)

			require.Equal(t, "folder1", allExport.Groups[0].Folder)
			require.Equal(t, "folder2", allExport.Groups[1].Folder)
		})

		t.Run("Export from one folder", func(t *testing.T) {
			expected := allExport.Groups[0]
			status, exportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				FolderUID:         []string{"folder1"},
			})
			require.Equal(t, http.StatusOK, status)
			var export apimodels.AlertingFileExport
			require.NoError(t, json.Unmarshal([]byte(exportRaw), &export))

			require.Len(t, export.Groups, 1)
			require.Equal(t, expected, export.Groups[0])
		})

		t.Run("Export from one group", func(t *testing.T) {
			expected := allExport.Groups[0]
			status, exportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				FolderUID:         []string{"folder1"},
				GroupName:         expected.Name,
			})
			require.Equal(t, http.StatusOK, status)
			var export apimodels.AlertingFileExport
			require.NoError(t, json.Unmarshal([]byte(exportRaw), &export))

			require.Len(t, export.Groups, 1)
			require.Equal(t, expected, export.Groups[0])
		})

		t.Run("Export single rule", func(t *testing.T) {
			expected := allExport.Groups[0]
			expected.Rules = []apimodels.AlertRuleExport{
				expected.Rules[0],
			}
			status, exportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				RuleUID:           expected.Rules[0].UID,
			})

			require.Equal(t, http.StatusOK, status)
			var export apimodels.AlertingFileExport
			t.Log(exportRaw)
			require.NoError(t, json.Unmarshal([]byte(exportRaw), &export))

			require.Len(t, export.Groups, 1)
			require.Equal(t, expected, export.Groups[0])
		})
	})

	t.Run("when permissions for folder2 removed", func(t *testing.T) {
		// remove permissions from folder2
		removeFolderPermission(t, permissionsStore, 1, userID, org.RoleEditor, "folder2")
		apiClient.ReloadCachedPermissions(t)

		t.Run("Get all returns all rules", func(t *testing.T) {
			newAll, status, _ := apiClient.GetAllRulesWithStatus(t)
			require.Equal(t, http.StatusOK, status)
			require.NotContains(t, newAll, "folder2")
			require.Contains(t, newAll, "folder1")
		})

		t.Run("Get by folder returns groups in folder", func(t *testing.T) {
			_, status, _ := apiClient.GetAllRulesGroupInFolderWithStatus(t, "folder2")
			require.Equal(t, http.StatusForbidden, status)
		})

		t.Run("Get group returns a single group", func(t *testing.T) {
			u := fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules/folder2/arulegroup", apiClient.url)
			// nolint:gosec
			resp, err := http.Get(u)
			require.NoError(t, err)
			defer func() {
				_ = resp.Body.Close()
			}()
			assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		})

		t.Run("Export returns all rules", func(t *testing.T) {
			status, exportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
			})
			require.Equal(t, http.StatusOK, status)
			var export apimodels.AlertingFileExport
			require.NoError(t, json.Unmarshal([]byte(exportRaw), &export))

			require.Equal(t, http.StatusOK, status)
			require.Len(t, export.Groups, 1)
			require.Equal(t, "folder1", export.Groups[0].Folder)
		})

		t.Run("Export from one folder", func(t *testing.T) {
			status, _ := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				FolderUID:         []string{"folder2"},
			})
			assert.Equal(t, http.StatusForbidden, status)
		})

		t.Run("Export from one group", func(t *testing.T) {
			status, _ := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				FolderUID:         []string{"folder2"},
				GroupName:         "arulegroup",
			})
			assert.Equal(t, http.StatusForbidden, status)
		})

		t.Run("Export single rule", func(t *testing.T) {
			uid := allRules["folder2"][0].Rules[0].GrafanaManagedAlert.UID
			status, _ := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				RuleUID:           uid,
			})
			require.Equal(t, http.StatusForbidden, status)
		})

		t.Run("when all permissions are revoked", func(t *testing.T) {
			removeFolderPermission(t, permissionsStore, 1, userID, org.RoleEditor, "folder1")
			apiClient.ReloadCachedPermissions(t)

			rules, status, _ := apiClient.GetAllRulesWithStatus(t)
			require.Equal(t, http.StatusOK, status)
			require.Empty(t, rules)

			status, _ = apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
			})
			require.Equal(t, http.StatusNotFound, status)
		})
	})
}

func TestIntegrationAlertRuleNestedPermissions(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles:  []string{featuremgmt.FlagNestedFolders},
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)
	permissionsStore := resourcepermissions.NewStore(env.Cfg, env.SQLStore, featuremgmt.WithFeatures())

	// Create a user to make authenticated requests
	userID := createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder1", "folder1")
	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder2", "folder2")
	// Create a subfolder
	apiClient.CreateFolder(t, "subfolder", "subfolder", "folder1")

	postGroupRaw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1-post.json"))
	require.NoError(t, err)
	var group1 apimodels.PostableRuleGroupConfig
	require.NoError(t, json.Unmarshal(postGroupRaw, &group1))

	// Create rule under folder1
	_, status, response := apiClient.PostRulesGroupWithStatus(t, "folder1", &group1)
	require.Equalf(t, http.StatusAccepted, status, response)

	postGroupRaw, err = testData.ReadFile(path.Join("test-data", "rulegroup-2-post.json"))
	require.NoError(t, err)
	var group2 apimodels.PostableRuleGroupConfig
	require.NoError(t, json.Unmarshal(postGroupRaw, &group2))

	// Create rule under folder2
	_, status, response = apiClient.PostRulesGroupWithStatus(t, "folder2", &group2)
	require.Equalf(t, http.StatusAccepted, status, response)

	postGroupRaw, err = testData.ReadFile(path.Join("test-data", "rulegroup-3-post.json"))
	require.NoError(t, err)
	var group3 apimodels.PostableRuleGroupConfig
	require.NoError(t, json.Unmarshal(postGroupRaw, &group3))

	// Create rule under subfolder
	_, status, response = apiClient.PostRulesGroupWithStatus(t, "subfolder", &group3)
	require.Equalf(t, http.StatusAccepted, status, response)

	// With the rules created, let's make sure that rule definitions are stored.
	allRules, status, _ := apiClient.GetAllRulesWithStatus(t)
	require.Equal(t, http.StatusOK, status)
	status, allExportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
		ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
	})
	require.Equal(t, http.StatusOK, status)
	var allExport apimodels.AlertingFileExport
	require.NoError(t, json.Unmarshal([]byte(allExportRaw), &allExport))

	t.Run("when user has all permissions", func(t *testing.T) {
		t.Run("Get all returns all rules", func(t *testing.T) {
			var group1, group2, group3 apimodels.GettableRuleGroupConfig

			getGroup1Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1-get.json"))
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(getGroup1Raw, &group1))
			getGroup2Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-2-get.json"))
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(getGroup2Raw, &group2))
			getGroup3Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-3-get.json"))
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(getGroup3Raw, &group3))

			expected := apimodels.NamespaceConfigResponse{
				"folder1": []apimodels.GettableRuleGroupConfig{
					group1,
				},
				"folder2": []apimodels.GettableRuleGroupConfig{
					group2,
				},
				"folder1/subfolder": []apimodels.GettableRuleGroupConfig{
					group3,
				},
			}

			pathsToIgnore := []string{
				"GrafanaManagedAlert.Updated",
				"GrafanaManagedAlert.UID",
				"GrafanaManagedAlert.ID",
				"GrafanaManagedAlert.Data.Model",
				"GrafanaManagedAlert.NamespaceUID",
				"GrafanaManagedAlert.NamespaceID",
			}

			// compare expected and actual and ignore the dynamic fields
			diff := cmp.Diff(expected, allRules, cmp.FilterPath(func(path cmp.Path) bool {
				for _, s := range pathsToIgnore {
					if strings.Contains(path.String(), s) {
						return true
					}
				}
				return false
			}, cmp.Ignore()))

			require.Empty(t, diff)

			for _, rule := range allRules["folder1"][0].Rules {
				assert.Equal(t, "folder1", rule.GrafanaManagedAlert.NamespaceUID)
			}

			for _, rule := range allRules["folder2"][0].Rules {
				assert.Equal(t, "folder2", rule.GrafanaManagedAlert.NamespaceUID)
			}

			for _, rule := range allRules["folder1/subfolder"][0].Rules {
				assert.Equal(t, "subfolder", rule.GrafanaManagedAlert.NamespaceUID)
			}
		})

		t.Run("Get by folder returns groups in folder", func(t *testing.T) {
			rules, status, _ := apiClient.GetAllRulesGroupInFolderWithStatus(t, "folder1")
			require.Equal(t, http.StatusAccepted, status)
			require.Contains(t, rules, "folder1")
			require.Len(t, rules["folder1"], 1)
			require.Equal(t, allRules["folder1"], rules["folder1"])
		})

		t.Run("Get group returns a single group", func(t *testing.T) {
			rules := apiClient.GetRulesGroup(t, "folder2", allRules["folder2"][0].Name)
			cmp.Diff(allRules["folder2"][0], rules.GettableRuleGroupConfig)
		})

		t.Run("Get by folder returns groups in folder with nested folder format", func(t *testing.T) {
			rules, status, _ := apiClient.GetAllRulesGroupInFolderWithStatus(t, "subfolder")
			require.Equal(t, http.StatusAccepted, status)

			nestedKey := "folder1/subfolder"
			require.Contains(t, rules, nestedKey)
			require.Len(t, rules[nestedKey], 1)
			require.Equal(t, allRules[nestedKey], rules[nestedKey])
		})

		t.Run("Export returns all rules", func(t *testing.T) {
			var group1File, group2File, group3File apimodels.AlertingFileExport
			getGroup1Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1-export.json"))
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(getGroup1Raw, &group1File))
			getGroup2Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-2-export.json"))
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(getGroup2Raw, &group2File))
			getGroup3Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-3-export.json"))
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(getGroup3Raw, &group3File))

			group1File.Groups = append(group1File.Groups, group2File.Groups...)
			group1File.Groups = append(group1File.Groups, group3File.Groups...)
			expected := group1File

			pathsToIgnore := []string{
				"Groups.Rules.UID",
				"Groups.Folder",
			}

			// compare expected and actual and ignore the dynamic fields
			diff := cmp.Diff(expected, allExport, cmp.FilterPath(func(path cmp.Path) bool {
				for _, s := range pathsToIgnore {
					if strings.Contains(path.String(), s) {
						return true
					}
				}
				return false
			}, cmp.Ignore()))

			require.Empty(t, diff)

			require.Equal(t, "folder1", allExport.Groups[0].Folder)
			require.Equal(t, "folder2", allExport.Groups[1].Folder)
			require.Equal(t, "folder1/subfolder", allExport.Groups[2].Folder)
		})

		t.Run("Export from one folder", func(t *testing.T) {
			expected := allExport.Groups[0]
			status, exportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				FolderUID:         []string{"folder1"},
			})
			require.Equal(t, http.StatusOK, status)
			var export apimodels.AlertingFileExport
			require.NoError(t, json.Unmarshal([]byte(exportRaw), &export))

			require.Len(t, export.Groups, 1)
			require.Equal(t, expected, export.Groups[0])
		})

		t.Run("Export from a subfolder", func(t *testing.T) {
			expected := allExport.Groups[2]
			status, exportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				FolderUID:         []string{"subfolder"},
			})
			require.Equal(t, http.StatusOK, status)
			var export apimodels.AlertingFileExport
			require.NoError(t, json.Unmarshal([]byte(exportRaw), &export))

			require.Len(t, export.Groups, 1)
			require.Equal(t, expected, export.Groups[0])
		})

		t.Run("Export from one group", func(t *testing.T) {
			expected := allExport.Groups[0]
			status, exportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				FolderUID:         []string{"folder1"},
				GroupName:         expected.Name,
			})
			require.Equal(t, http.StatusOK, status)
			var export apimodels.AlertingFileExport
			require.NoError(t, json.Unmarshal([]byte(exportRaw), &export))

			require.Len(t, export.Groups, 1)
			require.Equal(t, expected, export.Groups[0])
		})

		t.Run("Export from one group under subfolder", func(t *testing.T) {
			expected := allExport.Groups[2]
			status, exportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				FolderUID:         []string{"subfolder"},
				GroupName:         expected.Name,
			})
			require.Equal(t, http.StatusOK, status)
			var export apimodels.AlertingFileExport
			require.NoError(t, json.Unmarshal([]byte(exportRaw), &export))

			require.Len(t, export.Groups, 1)
			require.Equal(t, expected, export.Groups[0])
		})

		t.Run("Export single rule", func(t *testing.T) {
			expected := allExport.Groups[0]
			expected.Rules = []apimodels.AlertRuleExport{
				expected.Rules[0],
			}
			status, exportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				RuleUID:           expected.Rules[0].UID,
			})

			require.Equal(t, http.StatusOK, status)
			var export apimodels.AlertingFileExport
			t.Log(exportRaw)
			require.NoError(t, json.Unmarshal([]byte(exportRaw), &export))

			require.Len(t, export.Groups, 1)
			require.Equal(t, expected, export.Groups[0])
		})
	})

	t.Run("when permissions for folder2 removed", func(t *testing.T) {
		// remove permissions for folder2
		removeFolderPermission(t, permissionsStore, 1, userID, org.RoleEditor, "folder2")
		// remove permissions for subfolder (inherits from folder1)
		removeFolderPermission(t, permissionsStore, 1, userID, org.RoleEditor, "subfolder")
		apiClient.ReloadCachedPermissions(t)

		t.Run("Get all returns all rules", func(t *testing.T) {
			newAll, status, _ := apiClient.GetAllRulesWithStatus(t)
			require.Equal(t, http.StatusOK, status)
			require.Contains(t, newAll, "folder1")
			require.NotContains(t, newAll, "folder2")
			require.Contains(t, newAll, "folder1/subfolder")
		})

		t.Run("Get by folder returns groups in folder", func(t *testing.T) {
			_, status, _ := apiClient.GetAllRulesGroupInFolderWithStatus(t, "folder2")
			require.Equal(t, http.StatusForbidden, status)
		})

		t.Run("Get group returns a single group", func(t *testing.T) {
			u := fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules/folder2/arulegroup", apiClient.url)
			// nolint:gosec
			resp, err := http.Get(u)
			require.NoError(t, err)
			defer func() {
				_ = resp.Body.Close()
			}()
			assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		})

		t.Run("Export returns all rules", func(t *testing.T) {
			status, exportRaw := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
			})
			require.Equal(t, http.StatusOK, status)
			var export apimodels.AlertingFileExport
			require.NoError(t, json.Unmarshal([]byte(exportRaw), &export))

			require.Equal(t, http.StatusOK, status)
			require.Len(t, export.Groups, 2)
			require.Equal(t, "folder1", export.Groups[0].Folder)
			require.Equal(t, "folder1/subfolder", export.Groups[1].Folder)
		})

		t.Run("Export from one folder", func(t *testing.T) {
			status, _ := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				FolderUID:         []string{"folder2"},
			})
			assert.Equal(t, http.StatusForbidden, status)
		})

		t.Run("Export from one group", func(t *testing.T) {
			status, _ := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				FolderUID:         []string{"folder2"},
				GroupName:         "arulegroup",
			})
			assert.Equal(t, http.StatusForbidden, status)
		})

		t.Run("Export single rule", func(t *testing.T) {
			uid := allRules["folder2"][0].Rules[0].GrafanaManagedAlert.UID
			status, _ := apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
				RuleUID:           uid,
			})
			require.Equal(t, http.StatusForbidden, status)
		})

		t.Run("when all permissions are revoked", func(t *testing.T) {
			removeFolderPermission(t, permissionsStore, 1, userID, org.RoleEditor, "folder1")
			apiClient.ReloadCachedPermissions(t)

			rules, status, _ := apiClient.GetAllRulesWithStatus(t)
			require.Equal(t, http.StatusOK, status)
			require.Empty(t, rules)

			status, _ = apiClient.ExportRulesWithStatus(t, &apimodels.AlertRulesExportParameters{
				ExportQueryParams: apimodels.ExportQueryParams{Format: "json"},
			})
			require.Equal(t, http.StatusNotFound, status)
		})
	})
}

func createRule(t *testing.T, client apiClient, folder string) (apimodels.PostableRuleGroupConfig, string) {
	t.Helper()

	interval, err := model.ParseDuration("1m")
	require.NoError(t, err)
	doubleInterval := 2 * interval
	rules := apimodels.PostableRuleGroupConfig{
		Name:     "arulegroup",
		Interval: interval,
		Rules: []apimodels.PostableExtendedRuleNode{
			{
				ApiRuleNode: &apimodels.ApiRuleNode{
					For:         &doubleInterval,
					Labels:      map[string]string{"label1": "val1"},
					Annotations: map[string]string{"annotation1": "val1"},
				},
				GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
					Title:     fmt.Sprintf("rule under folder %s", folder),
					Condition: "A",
					Data: []apimodels.AlertQuery{
						{
							RefID: "A",
							RelativeTimeRange: apimodels.RelativeTimeRange{
								From: apimodels.Duration(time.Duration(5) * time.Hour),
								To:   apimodels.Duration(time.Duration(3) * time.Hour),
							},
							DatasourceUID: expr.DatasourceUID,
							Model: json.RawMessage(`{
								"type": "math",
								"expression": "2 + 3 > 1"
								}`),
						},
					},
				},
			},
		},
	}
	resp, status, _ := client.PostRulesGroupWithStatus(t, folder, &rules)
	assert.Equal(t, http.StatusAccepted, status)
	require.Len(t, resp.Created, 1)
	return rules, resp.Created[0]
}

func TestAlertRulePostExport(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)
	permissionsStore := resourcepermissions.NewStore(env.Cfg, env.SQLStore, featuremgmt.WithFeatures())

	// Create a user to make authenticated requests
	userID := createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder1", "folder1")

	var group1 apimodels.PostableRuleGroupConfig

	group1Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1-post.json"))
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(group1Raw, &group1))

	t.Run("should return in export format", func(t *testing.T) {
		var expected, actual apimodels.AlertingFileExport
		getGroup1Raw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1-export.json"))
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(getGroup1Raw, &expected))

		status, actualRaw := apiClient.PostRulesExportWithStatus(t, "folder1", &group1, &apimodels.ExportQueryParams{
			Download: false,
			Format:   "json",
		})
		require.Equal(t, http.StatusOK, status)
		require.NoError(t, json.Unmarshal([]byte(actualRaw), &actual))

		pathsToIgnore := []string{
			"Groups.Rules.UID",
			"Groups.Folder",
			"Data.Model", // Model is not amended with default values
		}

		// compare expected and actual and ignore the dynamic fields
		diff := cmp.Diff(expected, actual, cmp.FilterPath(func(path cmp.Path) bool {
			for _, s := range pathsToIgnore {
				if strings.Contains(path.String(), s) {
					return true
				}
			}
			return false
		}, cmp.Ignore()))

		require.Empty(t, diff)

		require.Equal(t, actual.Groups[0].Folder, "folder1")
	})

	t.Run("should return 403 when no access to folder", func(t *testing.T) {
		removeFolderPermission(t, permissionsStore, 1, userID, org.RoleEditor, "folder1")
		apiClient.ReloadCachedPermissions(t)

		status, _ := apiClient.PostRulesExportWithStatus(t, "folder1", &group1, &apimodels.ExportQueryParams{
			Download: false,
			Format:   "json",
		})
		require.Equal(t, http.StatusForbidden, status)
	})
}

func TestIntegrationAlertRuleEditorSettings(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	const folderName = "folder1"
	const groupName = "test-group"

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		EnableQuota:           true,
		DisableAnonymous:      true,
		ViewersCanEdit:        true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})
	apiClient.CreateFolder(t, folderName, folderName)

	createAlertInGrafana := func(metadata *apimodels.AlertRuleMetadata) apimodels.GettableRuleGroupConfig {
		interval, err := model.ParseDuration("1m")
		require.NoError(t, err)
		alertRule := apimodels.PostableExtendedRuleNode{
			ApiRuleNode: &apimodels.ApiRuleNode{
				For:         &interval,
				Labels:      map[string]string{"label1": "val1"},
				Annotations: map[string]string{"annotation1": "val1"},
			},
			GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
				Title:     "AlwaysFiring",
				Condition: "A",
				Data: []apimodels.AlertQuery{
					{
						RefID: "A",
						RelativeTimeRange: apimodels.RelativeTimeRange{
							From: apimodels.Duration(time.Duration(5) * time.Hour),
							To:   apimodels.Duration(time.Duration(3) * time.Hour),
						},
						DatasourceUID: expr.DatasourceUID,
						Model: json.RawMessage(`{
						"type": "math",
						"expression": "2 + 3 > 1"
						}`),
					},
				},
				Metadata: metadata,
			},
		}
		rules := apimodels.PostableRuleGroupConfig{
			Name: groupName,
			Rules: []apimodels.PostableExtendedRuleNode{
				alertRule,
			},
		}

		respModel, status, _ := apiClient.PostRulesGroupWithStatus(t, folderName, &rules)
		assert.Equal(t, http.StatusAccepted, status)
		require.Len(t, respModel.Created, 1)

		createdRuleGroup := apiClient.GetRulesGroup(t, folderName, rules.Name).GettableRuleGroupConfig
		require.Len(t, createdRuleGroup.Rules, 1)

		expectedMetadata := alertRule.GrafanaManagedAlert.Metadata
		if metadata == nil {
			expectedMetadata = &apimodels.AlertRuleMetadata{
				EditorSettings: apimodels.AlertRuleEditorSettings{
					SimplifiedQueryAndExpressionsSection: false,
				},
			}
		}
		require.Equal(t, expectedMetadata, createdRuleGroup.Rules[0].GrafanaManagedAlert.Metadata)

		return createdRuleGroup
	}

	t.Run("set simplified query editor in editor settings", func(t *testing.T) {
		metadata := &apimodels.AlertRuleMetadata{
			EditorSettings: apimodels.AlertRuleEditorSettings{
				SimplifiedQueryAndExpressionsSection: false,
			},
		}
		createdRuleGroup := createAlertInGrafana(metadata)

		rulesWithUID := convertGettableRuleGroupToPostable(createdRuleGroup)
		rulesWithUID.Rules[0].GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedQueryAndExpressionsSection = true

		_, status, _ := apiClient.PostRulesGroupWithStatus(t, folderName, &rulesWithUID)
		assert.Equal(t, http.StatusAccepted, status)

		updatedRuleGroup := apiClient.GetRulesGroup(t, folderName, groupName).GettableRuleGroupConfig
		require.Len(t, updatedRuleGroup.Rules, 1)
		require.True(t, updatedRuleGroup.Rules[0].GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedQueryAndExpressionsSection)
	})

	t.Run("disable simplified query editor in editor settings", func(t *testing.T) {
		metadata := &apimodels.AlertRuleMetadata{
			EditorSettings: apimodels.AlertRuleEditorSettings{
				SimplifiedQueryAndExpressionsSection: true,
			},
		}
		createdRuleGroup := createAlertInGrafana(metadata)

		rulesWithUID := convertGettableRuleGroupToPostable(createdRuleGroup)

		// disabling the editor
		rulesWithUID.Rules[0].GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedQueryAndExpressionsSection = false

		_, status, _ := apiClient.PostRulesGroupWithStatus(t, folderName, &rulesWithUID)
		assert.Equal(t, http.StatusAccepted, status)

		updatedRuleGroup := apiClient.GetRulesGroup(t, folderName, groupName).GettableRuleGroupConfig
		require.Len(t, updatedRuleGroup.Rules, 1)
		require.False(t, updatedRuleGroup.Rules[0].GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedQueryAndExpressionsSection)
	})

	t.Run("set simplified notifications editor in editor settings", func(t *testing.T) {
		metadata := &apimodels.AlertRuleMetadata{
			EditorSettings: apimodels.AlertRuleEditorSettings{
				SimplifiedQueryAndExpressionsSection: false,
			},
		}
		createdRuleGroup := createAlertInGrafana(metadata)

		rulesWithUID := convertGettableRuleGroupToPostable(createdRuleGroup)
		rulesWithUID.Rules[0].GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedNotificationsSection = true

		_, status, _ := apiClient.PostRulesGroupWithStatus(t, folderName, &rulesWithUID)
		assert.Equal(t, http.StatusAccepted, status)

		updatedRuleGroup := apiClient.GetRulesGroup(t, folderName, groupName).GettableRuleGroupConfig
		require.Len(t, updatedRuleGroup.Rules, 1)
		require.True(t, updatedRuleGroup.Rules[0].GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedNotificationsSection)
	})

	t.Run("disable simplified notifications editor in editor settings", func(t *testing.T) {
		metadata := &apimodels.AlertRuleMetadata{
			EditorSettings: apimodels.AlertRuleEditorSettings{
				SimplifiedNotificationsSection: true,
			},
		}
		createdRuleGroup := createAlertInGrafana(metadata)

		rulesWithUID := convertGettableRuleGroupToPostable(createdRuleGroup)

		// disabling the editor
		rulesWithUID.Rules[0].GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedNotificationsSection = false

		_, status, _ := apiClient.PostRulesGroupWithStatus(t, folderName, &rulesWithUID)
		assert.Equal(t, http.StatusAccepted, status)

		updatedRuleGroup := apiClient.GetRulesGroup(t, folderName, groupName).GettableRuleGroupConfig
		require.Len(t, updatedRuleGroup.Rules, 1)
		require.False(t, updatedRuleGroup.Rules[0].GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedNotificationsSection)
	})

	t.Run("post alert without metadata", func(t *testing.T) {
		createAlertInGrafana(nil)

		createdRuleGroup := apiClient.GetRulesGroup(t, folderName, groupName).GettableRuleGroupConfig
		require.Len(t, createdRuleGroup.Rules, 1)
		require.False(t, createdRuleGroup.Rules[0].GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedQueryAndExpressionsSection)
	})
}

func TestIntegrationAlertRuleConflictingTitle(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		EnableQuota:           true,
		DisableAnonymous:      true,
		ViewersCanEdit:        true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create user
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder1", "folder1")
	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder2", "folder2")

	rules := newTestingRuleConfig(t)

	respModel, status, _ := apiClient.PostRulesGroupWithStatus(t, "folder1", &rules)
	assert.Equal(t, http.StatusAccepted, status)
	require.Len(t, respModel.Created, len(rules.Rules))

	// fetch the created rules, so we can get the uid's and trigger
	// and update by reusing the uid's
	createdRuleGroup := apiClient.GetRulesGroup(t, "folder1", rules.Name).GettableRuleGroupConfig
	require.Len(t, createdRuleGroup.Rules, 2)

	t.Run("trying to create alert with same title under same folder should fail", func(t *testing.T) {
		rulesWithUID := convertGettableRuleGroupToPostable(createdRuleGroup)
		rulesWithUID.Rules = append(rulesWithUID.Rules, rules.Rules[0]) // Create new copy of first rule.

		_, status, body := apiClient.PostRulesGroupWithStatus(t, "folder1", &rulesWithUID)
		assert.Equal(t, http.StatusConflict, status)

		var res map[string]any
		require.NoError(t, json.Unmarshal([]byte(body), &res))
		require.Contains(t, res["message"], ngmodels.ErrAlertRuleUniqueConstraintViolation.Error())
	})

	t.Run("trying to update an alert to the title of an existing alert in the same folder should fail", func(t *testing.T) {
		rulesWithUID := convertGettableRuleGroupToPostable(createdRuleGroup)
		rulesWithUID.Rules[1].GrafanaManagedAlert.Title = "AlwaysFiring"

		_, status, body := apiClient.PostRulesGroupWithStatus(t, "folder1", &rulesWithUID)
		assert.Equal(t, http.StatusConflict, status)

		var res map[string]any
		require.NoError(t, json.Unmarshal([]byte(body), &res))
		require.Contains(t, res["message"], ngmodels.ErrAlertRuleUniqueConstraintViolation.Error())
	})

	t.Run("trying to create alert with same title under another folder should succeed", func(t *testing.T) {
		rules := newTestingRuleConfig(t)
		resp, status, _ := apiClient.PostRulesGroupWithStatus(t, "folder2", &rules)
		assert.Equal(t, http.StatusAccepted, status)
		require.Len(t, resp.Created, len(rules.Rules))
	})

	t.Run("trying to swap titles of existing alerts in the same folder should work", func(t *testing.T) {
		rulesWithUID := convertGettableRuleGroupToPostable(createdRuleGroup)
		title0 := rulesWithUID.Rules[0].GrafanaManagedAlert.Title
		title1 := rulesWithUID.Rules[1].GrafanaManagedAlert.Title
		rulesWithUID.Rules[0].GrafanaManagedAlert.Title = title1
		rulesWithUID.Rules[1].GrafanaManagedAlert.Title = title0

		resp, status, _ := apiClient.PostRulesGroupWithStatus(t, "folder1", &rulesWithUID)
		assert.Equal(t, http.StatusAccepted, status)
		require.Len(t, resp.Updated, 2)
	})

	t.Run("trying to update titles of existing alerts in a chain in the same folder should work", func(t *testing.T) {
		rulesWithUID := convertGettableRuleGroupToPostable(createdRuleGroup)
		rulesWithUID.Rules[0].GrafanaManagedAlert.Title = rulesWithUID.Rules[1].GrafanaManagedAlert.Title
		rulesWithUID.Rules[1].GrafanaManagedAlert.Title = "something new"

		resp, status, _ := apiClient.PostRulesGroupWithStatus(t, "folder1", &rulesWithUID)
		assert.Equal(t, http.StatusAccepted, status)
		require.Len(t, resp.Updated, len(rulesWithUID.Rules))
	})
}

func TestIntegrationRulerRulesFilterByDashboard(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		DisableAnonymous:     true,
		AppModeProduction:    true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	dashboardUID := "default"
	// Create the namespace under default organisation (orgID = 1) where we'll save our alerts to.
	apiClient.CreateFolder(t, "default", "default")

	interval, err := model.ParseDuration("10s")
	require.NoError(t, err)

	// Now, let's create some rules
	{
		rules := apimodels.PostableRuleGroupConfig{
			Name: "anotherrulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:    &interval,
						Labels: map[string]string{},
						Annotations: map[string]string{
							"__dashboardUid__": dashboardUID,
							"__panelId__":      "1",
						},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "AlwaysFiring",
						Condition: "A",
						Data: []apimodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: apimodels.RelativeTimeRange{
									From: apimodels.Duration(time.Duration(5) * time.Hour),
									To:   apimodels.Duration(time.Duration(3) * time.Hour),
								},
								DatasourceUID: expr.DatasourceUID,
								Model: json.RawMessage(`{
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
					},
				},
				{
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "AlwaysFiringButSilenced",
						Condition: "A",
						Data: []apimodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: apimodels.RelativeTimeRange{
									From: apimodels.Duration(time.Duration(5) * time.Hour),
									To:   apimodels.Duration(time.Duration(3) * time.Hour),
								},
								DatasourceUID: expr.DatasourceUID,
								Model: json.RawMessage(`{
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
						NoDataState:  apimodels.NoDataState(ngmodels.Alerting),
						ExecErrState: apimodels.ExecutionErrorState(ngmodels.AlertingErrState),
					},
				},
			},
		}
		resp, status, _ := apiClient.PostRulesGroupWithStatus(t, "default", &rules)
		assert.Equal(t, http.StatusAccepted, status)
		require.Len(t, resp.Created, len(rules.Rules))
	}

	expectedAllJSON := fmt.Sprintf(`
{
	"default": [{
		"name": "anotherrulegroup",
		"interval": "1m",
		"rules": [{
			"expr": "",
			"for": "10s",
			"annotations": {
				"__dashboardUid__": "%s",
				"__panelId__": "1"
			},
			"grafana_alert": {
				"id": 1,
				"orgId": 1,
				"title": "AlwaysFiring",
				"condition": "A",
				"data": [{
					"refId": "A",
					"queryType": "",
					"relativeTimeRange": {
						"from": 18000,
						"to": 10800
					},
					"datasourceUid": "__expr__",
					"model": {
						"expression": "2 + 3 \u003e 1",
						"intervalMs": 1000,
						"maxDataPoints": 43200,
						"type": "math"
					}
				}],
				"updated": "2021-02-21T01:10:30Z",
				"intervalSeconds": 60,
				"is_paused": false,
				"version": 1,
				"uid": "uid",
				"namespace_uid": "nsuid",
				"rule_group": "anotherrulegroup",
				"no_data_state": "NoData",
				"exec_err_state": "Alerting",
				"metadata": {
					"editor_settings": {
						"simplified_query_and_expressions_section": false,
						"simplified_notifications_section": false
					}
				}
			}
		}, {
			"expr": "",
			"for":"0s",
			"grafana_alert": {
				"id": 2,
				"orgId": 1,
				"title": "AlwaysFiringButSilenced",
				"condition": "A",
				"data": [{
					"refId": "A",
					"queryType": "",
					"relativeTimeRange": {
						"from": 18000,
						"to": 10800
					},
					"datasourceUid": "__expr__",
					"model": {
						"expression": "2 + 3 \u003e 1",
						"intervalMs": 1000,
						"maxDataPoints": 43200,
						"type": "math"
					}
				}],
				"updated": "2021-02-21T01:10:30Z",
				"intervalSeconds": 60,
				"is_paused": false,
				"version": 1,
				"uid": "uid",
				"namespace_uid": "nsuid",
				"rule_group": "anotherrulegroup",
				"no_data_state": "Alerting",
				"exec_err_state": "Alerting",
				"metadata": {
					"editor_settings": {
						"simplified_query_and_expressions_section": false,
						"simplified_notifications_section": false
					}
				}
			}
		}]
	}]
}`, dashboardUID)
	expectedFilteredByJSON := fmt.Sprintf(`
{
	"default": [{
		"name": "anotherrulegroup",
		"interval": "1m",
		"rules": [{
			"expr": "",
			"for": "10s",
			"annotations": {
				"__dashboardUid__": "%s",
				"__panelId__": "1"
			},
			"grafana_alert": {
				"id": 1,
				"orgId": 1,
				"title": "AlwaysFiring",
				"condition": "A",
				"data": [{
					"refId": "A",
					"queryType": "",
					"relativeTimeRange": {
						"from": 18000,
						"to": 10800
					},
					"datasourceUid": "__expr__",
					"model": {
						"expression": "2 + 3 \u003e 1",
						"intervalMs": 1000,
						"maxDataPoints": 43200,
						"type": "math"
					}
				}],
				"updated": "2021-02-21T01:10:30Z",
				"intervalSeconds": 60,
				"is_paused": false,
				"version": 1,
				"uid": "uid",
				"namespace_uid": "nsuid",
				"rule_group": "anotherrulegroup",
				"no_data_state": "NoData",
				"exec_err_state": "Alerting",
				"metadata": {
					"editor_settings": {
						"simplified_query_and_expressions_section": false,
						"simplified_notifications_section": false
					}
				}
			}
		}]
	}]
}`, dashboardUID)
	expectedNoneJSON := `{}`

	// Now, let's see how this looks like.
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		body, _ := rulesNamespaceWithoutVariableValues(t, b)
		require.JSONEq(t, expectedAllJSON, body)
	}

	// Now, let's check we get the same rule when filtering by dashboard_uid
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?dashboard_uid=%s", grafanaListedAddr, dashboardUID)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		body, _ := rulesNamespaceWithoutVariableValues(t, b)
		require.JSONEq(t, expectedFilteredByJSON, body)
	}

	// Now, let's check we get no rules when filtering by an unknown dashboard_uid
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?dashboard_uid=%s", grafanaListedAddr, "abc")
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		require.JSONEq(t, expectedNoneJSON, string(b))
	}

	// Now, let's check we get the same rule when filtering by dashboard_uid and panel_id
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?dashboard_uid=%s&panel_id=1", grafanaListedAddr, dashboardUID)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		body, _ := rulesNamespaceWithoutVariableValues(t, b)
		require.JSONEq(t, expectedFilteredByJSON, body)
	}

	// Now, let's check we get no rules when filtering by dashboard_uid and unknown panel_id
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?dashboard_uid=%s&panel_id=2", grafanaListedAddr, dashboardUID)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		require.JSONEq(t, expectedNoneJSON, string(b))
	}

	// Now, let's check an invalid panel_id returns a 400 Bad Request response
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?dashboard_uid=%s&panel_id=invalid", grafanaListedAddr, dashboardUID)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		require.NoError(t, json.Unmarshal(b, &res))
		require.Equal(t, `invalid panel_id: strconv.ParseInt: parsing "invalid": invalid syntax`, res["message"])
	}

	// Now, let's check a panel_id without dashboard_uid returns a 400 Bad Request response
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?panel_id=1", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		require.NoError(t, json.Unmarshal(b, &res))
		require.Equal(t, "panel_id must be set with dashboard_uid", res["message"])
	}
}

func TestIntegrationRuleGroupSequence(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	client := newAlertingApiClient(grafanaListedAddr, "grafana", "password")
	parentFolderUID := util.GenerateShortUID()
	client.CreateFolder(t, parentFolderUID, "parent")
	folderUID := util.GenerateShortUID()
	client.CreateFolder(t, folderUID, "folder1", parentFolderUID)

	group1 := generateAlertRuleGroup(5, alertRuleGen())
	group2 := generateAlertRuleGroup(5, alertRuleGen())

	_, status, _ := client.PostRulesGroupWithStatus(t, folderUID, &group1)
	require.Equal(t, http.StatusAccepted, status)
	_, status, _ = client.PostRulesGroupWithStatus(t, folderUID, &group2)
	require.Equal(t, http.StatusAccepted, status)

	t.Run("should persist order of the rules in a group", func(t *testing.T) {
		group1Get := client.GetRulesGroup(t, folderUID, group1.Name)
		assert.Equal(t, group1.Name, group1Get.Name)
		assert.Equal(t, group1.Interval, group1Get.Interval)
		assert.Len(t, group1Get.Rules, len(group1.Rules))
		for i, getRule := range group1Get.Rules {
			rule := group1.Rules[i]
			assert.Equal(t, getRule.GrafanaManagedAlert.Title, rule.GrafanaManagedAlert.Title)
			assert.NotEmpty(t, getRule.GrafanaManagedAlert.UID)
		}

		// now shuffle the rules
		postableGroup1 := convertGettableRuleGroupToPostable(group1Get.GettableRuleGroupConfig)
		rand.Shuffle(len(postableGroup1.Rules), func(i, j int) {
			postableGroup1.Rules[i], postableGroup1.Rules[j] = postableGroup1.Rules[j], postableGroup1.Rules[i]
		})
		expectedUids := make([]string, 0, len(postableGroup1.Rules))
		for _, rule := range postableGroup1.Rules {
			expectedUids = append(expectedUids, rule.GrafanaManagedAlert.UID)
		}
		_, status, _ := client.PostRulesGroupWithStatus(t, folderUID, &postableGroup1)
		require.Equal(t, http.StatusAccepted, status)

		group1Get = client.GetRulesGroup(t, folderUID, group1.Name)

		require.Len(t, group1Get.Rules, len(postableGroup1.Rules))

		actualUids := make([]string, 0, len(group1Get.Rules))
		for _, getRule := range group1Get.Rules {
			actualUids = append(actualUids, getRule.GrafanaManagedAlert.UID)
		}
		assert.Equal(t, expectedUids, actualUids)
	})

	t.Run("should be able to move a rule from another group in a specific position", func(t *testing.T) {
		group1Get := client.GetRulesGroup(t, folderUID, group1.Name)
		group2Get := client.GetRulesGroup(t, folderUID, group2.Name)

		movedRule := convertGettableRuleToPostable(group2Get.Rules[3])
		// now shuffle the rules
		postableGroup1 := convertGettableRuleGroupToPostable(group1Get.GettableRuleGroupConfig)
		postableGroup1.Rules = append(append(append([]apimodels.PostableExtendedRuleNode{}, postableGroup1.Rules[0:1]...), movedRule), postableGroup1.Rules[2:]...)
		expectedUids := make([]string, 0, len(postableGroup1.Rules))
		for _, rule := range postableGroup1.Rules {
			expectedUids = append(expectedUids, rule.GrafanaManagedAlert.UID)
		}
		_, status, _ := client.PostRulesGroupWithStatus(t, folderUID, &postableGroup1)
		require.Equal(t, http.StatusAccepted, status)

		group1Get = client.GetRulesGroup(t, folderUID, group1.Name)

		require.Len(t, group1Get.Rules, len(postableGroup1.Rules))

		actualUids := make([]string, 0, len(group1Get.Rules))
		for _, getRule := range group1Get.Rules {
			actualUids = append(actualUids, getRule.GrafanaManagedAlert.UID)
		}
		assert.Equal(t, expectedUids, actualUids)

		group2Get = client.GetRulesGroup(t, folderUID, group2.Name)
		assert.Len(t, group2Get.Rules, len(group2.Rules)-1)
		for _, rule := range group2Get.Rules {
			require.NotEqual(t, movedRule.GrafanaManagedAlert.UID, rule.GrafanaManagedAlert.UID)
		}
	})
}

func TestIntegrationRuleCreate(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		AppModeProduction:     true,
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})
	client := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	namespaceUID := "default"
	client.CreateFolder(t, namespaceUID, namespaceUID)

	cases := []struct {
		name   string
		config apimodels.PostableRuleGroupConfig
	}{{
		name: "can create a rule with UTF-8",
		config: apimodels.PostableRuleGroupConfig{
			Name:     "test1",
			Interval: model.Duration(time.Minute),
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For: util.Pointer(model.Duration(2 * time.Minute)),
						Labels: map[string]string{
							"foo🙂":  "bar",
							"_bar1": "baz🙂",
						},
						Annotations: map[string]string{
							"Προμηθέας": "prom",      // Prometheus in Greek
							"犬":         "Shiba Inu", // Dog in Japanese
						},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "test1 rule1",
						Condition: "A",
						Data: []apimodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: apimodels.RelativeTimeRange{
									From: apimodels.Duration(0),
									To:   apimodels.Duration(15 * time.Minute),
								},
								DatasourceUID: expr.DatasourceUID,
								Model:         json.RawMessage(`{"type": "math","expression": "1"}`),
							},
						},
					},
				},
			},
		},
	}}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp, status, _ := client.PostRulesGroupWithStatus(t, namespaceUID, &tc.config)
			require.Equal(t, http.StatusAccepted, status)
			require.Len(t, resp.Created, 1)
			require.Len(t, resp.Updated, 0)
			require.Len(t, resp.Deleted, 0)
		})
	}
}

func TestIntegrationRuleUpdate(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	permissionsStore := resourcepermissions.NewStore(env.Cfg, env.SQLStore, featuremgmt.WithFeatures())

	// Create a user to make authenticated requests
	userID := createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	if setting.IsEnterprise {
		// add blanket access to data sources.
		_, err := permissionsStore.SetUserResourcePermission(context.Background(),
			1,
			accesscontrol.User{ID: userID},
			resourcepermissions.SetResourcePermissionCommand{
				Actions: []string{
					datasources.ActionQuery,
				},
				Resource:          datasources.ScopeRoot,
				ResourceID:        "*",
				ResourceAttribute: "uid",
			}, nil)
		require.NoError(t, err)
	}

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	adminClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	client := newAlertingApiClient(grafanaListedAddr, "grafana", "password")
	folderUID := util.GenerateShortUID()
	client.CreateFolder(t, folderUID, "folder1")

	t.Run("should be able to reset 'for' to 0", func(t *testing.T) {
		group := generateAlertRuleGroup(1, alertRuleGen())
		expected := model.Duration(10 * time.Second)
		group.Rules[0].ApiRuleNode.For = &expected

		_, status, body := client.PostRulesGroupWithStatus(t, folderUID, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)
		getGroup := client.GetRulesGroup(t, folderUID, group.Name)
		require.Equal(t, expected, *getGroup.Rules[0].ApiRuleNode.For)

		group = convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)
		expected = 0
		group.Rules[0].ApiRuleNode.For = &expected
		_, status, body = client.PostRulesGroupWithStatus(t, folderUID, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)

		getGroup = client.GetRulesGroup(t, folderUID, group.Name)
		require.Equal(t, expected, *getGroup.Rules[0].ApiRuleNode.For)
	})
	t.Run("when data source missing", func(t *testing.T) {
		var groupName string
		{
			ds1 := adminClient.CreateTestDatasource(t)
			group := generateAlertRuleGroup(3, alertRuleGen(withDatasourceQuery(ds1.Body.Datasource.UID)))

			_, status, body := client.PostRulesGroupWithStatus(t, folderUID, &group)
			require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)

			getGroup := client.GetRulesGroup(t, folderUID, group.Name)
			group = convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)

			require.Len(t, group.Rules, 3)

			adminClient.DeleteDatasource(t, ds1.Body.Datasource.UID)

			// expire datasource caching
			<-time.After(datasourceService.DefaultCacheTTL + 1*time.Second) // TODO delete when TTL could be configured

			groupName = group.Name
		}

		t.Run("noop should not fail", func(t *testing.T) {
			getGroup := client.GetRulesGroup(t, folderUID, groupName)
			group := convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)

			_, status, body := client.PostRulesGroupWithStatus(t, folderUID, &group)
			require.Equalf(t, http.StatusAccepted, status, "failed to post noop rule group. Response: %s", body)
		})
		t.Run("should not let update rule if it does not fix datasource", func(t *testing.T) {
			getGroup := client.GetRulesGroup(t, folderUID, groupName)
			group := convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)

			group.Rules[0].GrafanaManagedAlert.Title = uuid.NewString()
			resp, status, body := client.PostRulesGroupWithStatus(t, folderUID, &group)

			if status == http.StatusAccepted {
				assert.Len(t, resp.Deleted, 1)
				getGroup = client.GetRulesGroup(t, folderUID, group.Name)
				assert.NotEqualf(t, group.Rules[0].GrafanaManagedAlert.Title, getGroup.Rules[0].GrafanaManagedAlert.Title, "group was updated")
			}
			require.Equalf(t, http.StatusBadRequest, status, "expected BadRequest. Response: %s", body)
			assert.Contains(t, body, "data source not found")
		})
		t.Run("should let delete broken rule", func(t *testing.T) {
			getGroup := client.GetRulesGroup(t, folderUID, groupName)
			group := convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)

			// remove the last rule.
			group.Rules = group.Rules[0 : len(group.Rules)-1]
			resp, status, body := client.PostRulesGroupWithStatus(t, folderUID, &group)
			require.Equalf(t, http.StatusAccepted, status, "failed to delete last rule from group. Response: %s", body)
			assert.Len(t, resp.Deleted, 1)

			getGroup = client.GetRulesGroup(t, folderUID, group.Name)
			group = convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)
			require.Len(t, group.Rules, 2)
		})
		t.Run("should let fix single rule", func(t *testing.T) {
			getGroup := client.GetRulesGroup(t, folderUID, groupName)
			group := convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)

			ds2 := adminClient.CreateTestDatasource(t)
			withDatasourceQuery(ds2.Body.Datasource.UID)(&group.Rules[0])
			resp, status, body := client.PostRulesGroupWithStatus(t, folderUID, &group)
			require.Equalf(t, http.StatusAccepted, status, "failed to post noop rule group. Response: %s", body)
			assert.Len(t, resp.Deleted, 0)
			assert.Len(t, resp.Updated, 2)
			assert.Len(t, resp.Created, 0)

			getGroup = client.GetRulesGroup(t, folderUID, group.Name)
			group = convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)
			require.Equal(t, ds2.Body.Datasource.UID, group.Rules[0].GrafanaManagedAlert.Data[0].DatasourceUID)
		})
		t.Run("should let delete group", func(t *testing.T) {
			status, body := client.DeleteRulesGroup(t, folderUID, groupName)
			require.Equalf(t, http.StatusAccepted, status, "failed to post noop rule group. Response: %s", body)
		})
	})
}

func newTestingRuleConfig(t *testing.T) apimodels.PostableRuleGroupConfig {
	interval, err := model.ParseDuration("1m")
	require.NoError(t, err)

	firstRule := apimodels.PostableExtendedRuleNode{
		ApiRuleNode: &apimodels.ApiRuleNode{
			For:         &interval,
			Labels:      map[string]string{"label1": "val1"},
			Annotations: map[string]string{"annotation1": "val1"},
		},
		// this rule does not explicitly set no data and error states
		// therefore it should get the default values
		GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
			Title:     "AlwaysFiring",
			Condition: "A",
			Data: []apimodels.AlertQuery{
				{
					RefID: "A",
					RelativeTimeRange: apimodels.RelativeTimeRange{
						From: apimodels.Duration(time.Duration(5) * time.Hour),
						To:   apimodels.Duration(time.Duration(3) * time.Hour),
					},
					DatasourceUID: expr.DatasourceUID,
					Model: json.RawMessage(`{
						"type": "math",
						"expression": "2 + 3 > 1"
						}`),
				},
			},
		},
	}
	secondRule := apimodels.PostableExtendedRuleNode{
		ApiRuleNode: &apimodels.ApiRuleNode{
			For:         &interval,
			Labels:      map[string]string{"label1": "val1"},
			Annotations: map[string]string{"annotation1": "val1"},
		},
		// this rule does not explicitly set no data and error states
		// therefore it should get the default values
		GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
			Title:     "AlwaysFiring2",
			Condition: "A",
			Data: []apimodels.AlertQuery{
				{
					RefID: "A",
					RelativeTimeRange: apimodels.RelativeTimeRange{
						From: apimodels.Duration(time.Duration(5) * time.Hour),
						To:   apimodels.Duration(time.Duration(3) * time.Hour),
					},
					DatasourceUID: expr.DatasourceUID,
					Model: json.RawMessage(`{
						"type": "math",
						"expression": "2 + 3 > 1"
						}`),
				},
			},
		},
	}

	return apimodels.PostableRuleGroupConfig{
		Name: "arulegroup",
		Rules: []apimodels.PostableExtendedRuleNode{
			firstRule,
			secondRule,
		},
	}
}

func TestIntegrationRulePause(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	client := newAlertingApiClient(grafanaListedAddr, "grafana", "password")
	folderUID := util.GenerateShortUID()
	client.CreateFolder(t, folderUID, "folder1")

	t.Run("should create a paused rule if isPaused is true", func(t *testing.T) {
		group := generateAlertRuleGroup(1, alertRuleGen())
		expectedIsPaused := true
		group.Rules[0].GrafanaManagedAlert.IsPaused = &expectedIsPaused

		resp, status, body := client.PostRulesGroupWithStatus(t, folderUID, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)
		require.Len(t, resp.Created, 1)
		getGroup := client.GetRulesGroup(t, folderUID, group.Name)
		require.Equalf(t, http.StatusAccepted, status, "failed to get rule group. Response: %s", body)
		require.Equal(t, expectedIsPaused, getGroup.Rules[0].GrafanaManagedAlert.IsPaused)
	})

	t.Run("should create a unpaused rule if isPaused is false", func(t *testing.T) {
		group := generateAlertRuleGroup(1, alertRuleGen())
		expectedIsPaused := false
		group.Rules[0].GrafanaManagedAlert.IsPaused = &expectedIsPaused

		resp, status, body := client.PostRulesGroupWithStatus(t, folderUID, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)
		require.Len(t, resp.Created, 1)
		getGroup := client.GetRulesGroup(t, folderUID, group.Name)
		require.Equalf(t, http.StatusAccepted, status, "failed to get rule group. Response: %s", body)
		require.Equal(t, expectedIsPaused, getGroup.Rules[0].GrafanaManagedAlert.IsPaused)
	})

	t.Run("should create a unpaused rule if isPaused is not present", func(t *testing.T) {
		group := generateAlertRuleGroup(1, alertRuleGen())
		group.Rules[0].GrafanaManagedAlert.IsPaused = nil

		resp, status, body := client.PostRulesGroupWithStatus(t, folderUID, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)
		require.Len(t, resp.Created, 1)
		getGroup := client.GetRulesGroup(t, folderUID, group.Name)
		require.Equalf(t, http.StatusAccepted, status, "failed to get rule group. Response: %s", body)
		require.False(t, getGroup.Rules[0].GrafanaManagedAlert.IsPaused)
	})

	getBooleanPointer := func(b bool) *bool { return &b }
	testCases := []struct {
		description          string
		isPausedInDb         bool
		isPausedInBody       *bool
		expectedIsPausedInDb bool
	}{
		{
			description:          "should pause rule if there is a paused rule in DB and isPaused is true",
			isPausedInDb:         true,
			isPausedInBody:       getBooleanPointer(true),
			expectedIsPausedInDb: true,
		},
		{
			description:          "should unpause rule if there is a paused rule in DB and isPaused is false",
			isPausedInDb:         true,
			isPausedInBody:       getBooleanPointer(false),
			expectedIsPausedInDb: false,
		},
		{
			description:          "should keep rule paused if there is a paused rule in DB and isPaused is not present",
			isPausedInDb:         true,
			isPausedInBody:       nil,
			expectedIsPausedInDb: true,
		},
		{
			description:          "should pause rule if there is an unpaused rule in DB and isPaused is true",
			isPausedInDb:         false,
			isPausedInBody:       getBooleanPointer(true),
			expectedIsPausedInDb: true,
		},
		{
			description:          "should unpause rule if there is an unpaused rule in DB and isPaused is false",
			isPausedInDb:         false,
			isPausedInBody:       getBooleanPointer(false),
			expectedIsPausedInDb: false,
		},
		{
			description:          "should keep rule unpaused if there is an unpaused rule in DB and isPaused is not present",
			isPausedInDb:         false,
			isPausedInBody:       nil,
			expectedIsPausedInDb: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			group := generateAlertRuleGroup(1, alertRuleGen())
			group.Rules[0].GrafanaManagedAlert.IsPaused = &tc.isPausedInDb

			_, status, body := client.PostRulesGroupWithStatus(t, folderUID, &group)
			require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)
			getGroup := client.GetRulesGroup(t, folderUID, group.Name)
			require.Equalf(t, http.StatusAccepted, status, "failed to get rule group. Response: %s", body)

			group = convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)
			group.Rules[0].GrafanaManagedAlert.IsPaused = tc.isPausedInBody
			_, status, body = client.PostRulesGroupWithStatus(t, folderUID, &group)
			require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)

			getGroup = client.GetRulesGroup(t, folderUID, group.Name)
			require.Equal(t, tc.expectedIsPausedInDb, getGroup.Rules[0].GrafanaManagedAlert.IsPaused)
		})
	}
}

func TestIntegrationHysteresisRule(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database. Scheduler is set to evaluate every 1 second
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting:        true,
		EnableUnifiedAlerting:        true,
		DisableAnonymous:             true,
		AppModeProduction:            true,
		NGAlertSchedulerBaseInterval: 1 * time.Second,
		EnableFeatureToggles:         []string{featuremgmt.FlagConfigurableSchedulerTick, featuremgmt.FlagRecoveryThreshold},
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	folder := "hysteresis"
	testDs := apiClient.CreateTestDatasource(t)
	apiClient.CreateFolder(t, folder, folder)

	bodyRaw, err := testData.ReadFile("test-data/hysteresis_rule.json")
	require.NoError(t, err)

	var postData apimodels.PostableRuleGroupConfig
	require.NoError(t, json.Unmarshal(bodyRaw, &postData))
	for _, rule := range postData.Rules {
		for i := range rule.GrafanaManagedAlert.Data {
			rule.GrafanaManagedAlert.Data[i].DatasourceUID = strings.ReplaceAll(rule.GrafanaManagedAlert.Data[i].DatasourceUID, "REPLACE_ME", testDs.Body.Datasource.UID)
		}
	}
	changes, status, body := apiClient.PostRulesGroupWithStatus(t, folder, &postData)
	require.Equalf(t, http.StatusAccepted, status, body)
	require.Len(t, changes.Created, 1)
	ruleUid := changes.Created[0]

	var frame data.Frame
	require.Eventuallyf(t, func() bool {
		frame, status, body = apiClient.GetRuleHistoryWithStatus(t, ruleUid)
		require.Equalf(t, http.StatusOK, status, body)
		return frame.Rows() > 1
	}, 15*time.Second, 1*time.Second, "Alert state history expected to have more than one record but got %d. Body: %s", frame.Rows(), body)

	f, _ := frame.FieldByName("next")

	alertingIdx := 0
	normalIdx := 1
	if f.At(alertingIdx).(string) != "Alerting" {
		alertingIdx = 1
		normalIdx = 0
	}

	assert.Equalf(t, "Alerting", f.At(alertingIdx).(string), body)
	assert.Equalf(t, "Normal", f.At(normalIdx).(string), body)

	type HistoryData struct {
		Values map[string]int64
	}

	f, _ = frame.FieldByName("data")
	var d HistoryData
	require.NoErrorf(t, json.Unmarshal([]byte(f.At(alertingIdx).(string)), &d), body)
	assert.EqualValuesf(t, 5, d.Values["B"], body)
	require.NoErrorf(t, json.Unmarshal([]byte(f.At(normalIdx).(string)), &d), body)
	assert.EqualValuesf(t, 1, d.Values["B"], body)
}

func TestIntegrationRuleNotificationSettings(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database. Scheduler is set to evaluate every 1 second
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting:        true,
		EnableUnifiedAlerting:        true,
		DisableAnonymous:             true,
		AppModeProduction:            true,
		NGAlertSchedulerBaseInterval: 1 * time.Second,
		EnableFeatureToggles:         []string{featuremgmt.FlagConfigurableSchedulerTick, featuremgmt.FlagAlertingSimplifiedRouting},
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	folder := "Test-Alerting"
	apiClient.CreateFolder(t, folder, folder)

	testDataRaw, err := testData.ReadFile(path.Join("test-data", "rule-notification-settings-1-post.json"))
	require.NoError(t, err)

	type testData struct {
		RuleGroup    apimodels.PostableRuleGroupConfig
		Receiver     apimodels.EmbeddedContactPoint
		TimeInterval apimodels.MuteTimeInterval
	}
	var d testData
	err = json.Unmarshal(testDataRaw, &d)
	require.NoError(t, err)

	apiClient.EnsureReceiver(t, d.Receiver)
	apiClient.EnsureMuteTiming(t, d.TimeInterval)

	t.Run("create should fail if receiver does not exist", func(t *testing.T) {
		var copyD testData
		err = json.Unmarshal(testDataRaw, &copyD)
		group := copyD.RuleGroup
		ns := group.Rules[0].GrafanaManagedAlert.NotificationSettings
		ns.Receiver = "random-receiver"

		_, status, body := apiClient.PostRulesGroupWithStatus(t, folder, &group)
		require.Equalf(t, http.StatusBadRequest, status, body)
		t.Log(body)
	})

	t.Run("create should fail if mute timing does not exist", func(t *testing.T) {
		var copyD testData
		err = json.Unmarshal(testDataRaw, &copyD)
		group := copyD.RuleGroup
		ns := group.Rules[0].GrafanaManagedAlert.NotificationSettings
		ns.MuteTimeIntervals = []string{"random-time-interval"}

		_, status, body := apiClient.PostRulesGroupWithStatus(t, folder, &group)
		require.Equalf(t, http.StatusBadRequest, status, body)
		t.Log(body)
	})

	t.Run("create should not fail if group_by is missing required labels but they should still be used", func(t *testing.T) {
		var copyD testData
		err = json.Unmarshal(testDataRaw, &copyD)
		group := copyD.RuleGroup
		ns := group.Rules[0].GrafanaManagedAlert.NotificationSettings
		ns.GroupBy = []string{"label1"}

		_, status, body := apiClient.PostRulesGroupWithStatus(t, folder, &group)
		require.Equalf(t, http.StatusAccepted, status, body)

		cfg, status, body := apiClient.GetAlertmanagerConfigWithStatus(t)
		if !assert.Equalf(t, http.StatusOK, status, body) {
			return
		}

		// Ensure that the group by contains the default required labels.
		autogenRoute := cfg.AlertmanagerConfig.Route.Routes[0]
		receiverRoute := autogenRoute.Routes[0]
		ruleRoute := receiverRoute.Routes[0]
		assert.Equal(t, []model.LabelName{ngmodels.FolderTitleLabel, model.AlertNameLabel, "label1"}, ruleRoute.GroupBy)

		t.Log(body)
	})

	t.Run("create with '...' groupBy followed by config post should succeed", func(t *testing.T) {
		var copyD testData
		err = json.Unmarshal(testDataRaw, &copyD)
		group := copyD.RuleGroup
		ns := group.Rules[0].GrafanaManagedAlert.NotificationSettings
		ns.GroupBy = []string{ngmodels.FolderTitleLabel, model.AlertNameLabel, ngmodels.GroupByAll}

		_, status, body := apiClient.PostRulesGroupWithStatus(t, folder, &group)
		require.Equalf(t, http.StatusAccepted, status, body)

		// Now update the config with no changes.
		_, status, body = apiClient.GetAlertmanagerConfigWithStatus(t)
		if !assert.Equalf(t, http.StatusOK, status, body) {
			return
		}

		cfg := apimodels.PostableUserConfig{}

		err = json.Unmarshal([]byte(body), &cfg)
		require.NoError(t, err)

		ok, err := apiClient.PostConfiguration(t, cfg)
		require.NoError(t, err)
		require.True(t, ok)
	})

	t.Run("should create rule and generate route", func(t *testing.T) {
		_, status, body := apiClient.PostRulesGroupWithStatus(t, folder, &d.RuleGroup)
		require.Equalf(t, http.StatusAccepted, status, body)
		notificationSettings := d.RuleGroup.Rules[0].GrafanaManagedAlert.NotificationSettings

		var routeBody string
		if !assert.EventuallyWithT(t, func(c *assert.CollectT) {
			amConfig, status, body := apiClient.GetAlertmanagerConfigWithStatus(t)
			routeBody = body
			if !assert.Equalf(t, http.StatusOK, status, body) {
				return
			}
			route := amConfig.AlertmanagerConfig.Route

			if !assert.Len(c, route.Routes, 1) {
				return
			}

			// Check that we are in the auto-generated root
			autogenRoute := route.Routes[0]
			if !assert.Len(c, autogenRoute.ObjectMatchers, 1) {
				return
			}
			canContinue := assert.Equal(c, ngmodels.AutogeneratedRouteLabel, autogenRoute.ObjectMatchers[0].Name)
			assert.Equal(c, labels.MatchEqual, autogenRoute.ObjectMatchers[0].Type)
			assert.Equal(c, "true", autogenRoute.ObjectMatchers[0].Value)

			assert.Equalf(c, route.Receiver, autogenRoute.Receiver, "Autogenerated root receiver must be the default one")
			assert.Nil(c, autogenRoute.GroupWait)
			assert.Nil(c, autogenRoute.GroupInterval)
			assert.Nil(c, autogenRoute.RepeatInterval)
			assert.Empty(c, autogenRoute.MuteTimeIntervals)
			assert.Empty(c, autogenRoute.GroupBy)
			if !canContinue {
				return
			}
			// Now check that the second level is route for receivers
			if !assert.NotEmpty(c, autogenRoute.Routes) {
				return
			}
			// There can be many routes, for all receivers
			idx := slices.IndexFunc(autogenRoute.Routes, func(route *apimodels.Route) bool {
				return route.Receiver == notificationSettings.Receiver
			})
			if !assert.GreaterOrEqual(t, idx, 0) {
				return
			}
			receiverRoute := autogenRoute.Routes[idx]
			if !assert.Len(c, receiverRoute.ObjectMatchers, 1) {
				return
			}
			canContinue = assert.Equal(c, ngmodels.AutogeneratedRouteReceiverNameLabel, receiverRoute.ObjectMatchers[0].Name)
			assert.Equal(c, labels.MatchEqual, receiverRoute.ObjectMatchers[0].Type)
			assert.Equal(c, notificationSettings.Receiver, receiverRoute.ObjectMatchers[0].Value)

			assert.Equal(c, notificationSettings.Receiver, receiverRoute.Receiver)
			assert.Nil(c, receiverRoute.GroupWait)
			assert.Nil(c, receiverRoute.GroupInterval)
			assert.Nil(c, receiverRoute.RepeatInterval)
			assert.Empty(c, receiverRoute.MuteTimeIntervals)
			var groupBy []string
			for _, name := range receiverRoute.GroupBy {
				groupBy = append(groupBy, string(name))
			}
			slices.Sort(groupBy)
			assert.EqualValues(c, []string{"alertname", "grafana_folder"}, groupBy)
			if !canContinue {
				return
			}
			// Now check that we created the 3rd level for specific combination of settings
			if !assert.Lenf(c, receiverRoute.Routes, 1, "Receiver route should contain one options route") {
				return
			}
			optionsRoute := receiverRoute.Routes[0]
			if !assert.Len(c, optionsRoute.ObjectMatchers, 1) {
				return
			}
			assert.Equal(c, ngmodels.AutogeneratedRouteSettingsHashLabel, optionsRoute.ObjectMatchers[0].Name)
			assert.Equal(c, labels.MatchEqual, optionsRoute.ObjectMatchers[0].Type)
			assert.EqualValues(c, notificationSettings.GroupWait, optionsRoute.GroupWait)
			assert.EqualValues(c, notificationSettings.GroupInterval, optionsRoute.GroupInterval)
			assert.EqualValues(c, notificationSettings.RepeatInterval, optionsRoute.RepeatInterval)
			assert.EqualValues(c, notificationSettings.MuteTimeIntervals, optionsRoute.MuteTimeIntervals)
			groupBy = nil
			for _, name := range optionsRoute.GroupBy {
				groupBy = append(groupBy, string(name))
			}
			assert.EqualValues(c, notificationSettings.GroupBy, groupBy)
		}, 10*time.Second, 1*time.Second) {
			t.Logf("config: %s", routeBody)
		}
	})

	t.Run("should correctly create alerts", func(t *testing.T) {
		var response string
		if !assert.EventuallyWithT(t, func(c *assert.CollectT) {
			groups, status, body := apiClient.GetActiveAlertsWithStatus(t)
			require.Equalf(t, http.StatusOK, status, body)
			response = body
			if len(groups) == 0 {
				return
			}
			g := groups[0]
			alert := g.Alerts[0]
			assert.Contains(c, alert.Labels, ngmodels.AutogeneratedRouteLabel)
			assert.Equal(c, "true", alert.Labels[ngmodels.AutogeneratedRouteLabel])
			assert.Contains(c, alert.Labels, ngmodels.AutogeneratedRouteReceiverNameLabel)
			assert.Equal(c, d.Receiver.Name, alert.Labels[ngmodels.AutogeneratedRouteReceiverNameLabel])
			assert.Contains(c, alert.Labels, ngmodels.AutogeneratedRouteSettingsHashLabel)
			assert.NotEmpty(c, alert.Labels[ngmodels.AutogeneratedRouteSettingsHashLabel])
		}, 10*time.Second, 1*time.Second) {
			t.Logf("response: %s", response)
		}
	})

	t.Run("should update rule with empty settings and delete route", func(t *testing.T) {
		var copyD testData
		err = json.Unmarshal(testDataRaw, &copyD)
		group := copyD.RuleGroup
		notificationSettings := group.Rules[0].GrafanaManagedAlert.NotificationSettings
		group.Rules[0].GrafanaManagedAlert.NotificationSettings = nil

		_, status, body := apiClient.PostRulesGroupWithStatus(t, folder, &group)
		require.Equalf(t, http.StatusAccepted, status, body)

		var routeBody string
		if !assert.EventuallyWithT(t, func(c *assert.CollectT) {
			amConfig, status, body := apiClient.GetAlertmanagerConfigWithStatus(t)
			routeBody = body
			if !assert.Equalf(t, http.StatusOK, status, body) {
				return
			}
			route := amConfig.AlertmanagerConfig.Route

			if !assert.Len(c, route.Routes, 1) {
				return
			}
			// Check that we are in the auto-generated root
			autogenRoute := route.Routes[0]
			if !assert.Len(c, autogenRoute.ObjectMatchers, 1) {
				return
			}
			if !assert.Equal(c, ngmodels.AutogeneratedRouteLabel, autogenRoute.ObjectMatchers[0].Name) {
				return
			}
			// Now check that the second level is route for receivers
			if !assert.NotEmpty(c, autogenRoute.Routes) {
				return
			}
			// There can be many routes, for all receivers
			idx := slices.IndexFunc(autogenRoute.Routes, func(route *apimodels.Route) bool {
				return route.Receiver == notificationSettings.Receiver
			})
			if !assert.GreaterOrEqual(t, idx, 0) {
				return
			}
			receiverRoute := autogenRoute.Routes[idx]
			if !assert.Empty(c, receiverRoute.Routes) {
				return
			}
		}, 10*time.Second, 1*time.Second) {
			t.Logf("config: %s", routeBody)
		}
	})
}

func TestIntegrationRuleUpdateAllDatabases(t *testing.T) {
	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	client := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	folderUID := util.GenerateShortUID()
	client.CreateFolder(t, folderUID, "folder1")

	t.Run("group renamed followed by delete for case-only changes should not delete both groups", func(t *testing.T) { // Regression test.
		group := generateAlertRuleGroup(3, alertRuleGen())
		groupName := group.Name

		_, status, body := client.PostRulesGroupWithStatus(t, folderUID, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)
		getGroup := client.GetRulesGroup(t, folderUID, group.Name)
		require.Lenf(t, getGroup.Rules, 3, "expected 3 rules in group")
		require.Equal(t, groupName, getGroup.Rules[0].GrafanaManagedAlert.RuleGroup)

		group = convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)
		newGroup := strings.ToUpper(group.Name)
		group.Name = newGroup
		_, status, body = client.PostRulesGroupWithStatus(t, folderUID, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)

		getGroup = client.GetRulesGroup(t, folderUID, group.Name)
		require.Lenf(t, getGroup.Rules, 3, "expected 3 rules in group")
		require.Equal(t, newGroup, getGroup.Rules[0].GrafanaManagedAlert.RuleGroup)

		status, body = client.DeleteRulesGroup(t, folderUID, groupName)
		require.Equalf(t, http.StatusAccepted, status, "failed to post noop rule group. Response: %s", body)

		// Old group is gone.
		getGroup = client.GetRulesGroup(t, folderUID, groupName)
		require.Lenf(t, getGroup.Rules, 0, "expected no rules")

		// New group still exists.
		getGroup = client.GetRulesGroup(t, folderUID, newGroup)
		require.Lenf(t, getGroup.Rules, 3, "expected 3 rules in group")
		require.Equal(t, newGroup, getGroup.Rules[0].GrafanaManagedAlert.RuleGroup)
	})
}
