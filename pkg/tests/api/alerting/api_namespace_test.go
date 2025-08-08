package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/configprovider"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegration_NamespacingForRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)
	store, cfg := env.SQLStore, env.Cfg
	orgID := int64(1)
	createUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		OrgID:          orgID,
		Password:       "editor",
		Login:          "editor",
	})
	createUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		OrgID:          orgID,
		Password:       "viewer",
		Login:          "viewer",
	})

	adminClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")
	editorClient := newAlertingApiClient(grafanaListedAddr, "editor", "editor")
	viewerClient := newAlertingApiClient(grafanaListedAddr, "viewer", "viewer")

	// create test folders, with a rule in each folder
	folder1UID := "test-folder-1"
	folder2UID := "test-folder-2"
	folder3UID := "test-folder-3"
	adminClient.CreateFolder(t, folder1UID, "Test Folder 1")
	adminClient.CreateFolder(t, folder2UID, "Test Folder 2")
	adminClient.CreateFolder(t, folder3UID, "Test Folder 3")
	rule1 := createTestAlertRule("Test Rule 1", folder1UID)
	rule2 := createTestAlertRule("Test Rule 2", folder2UID)
	rule3 := createTestAlertRule("Test Rule 3", folder3UID)
	group1 := apimodels.PostableRuleGroupConfig{
		Name:     "test-group-1",
		Interval: 60,
		Rules:    []apimodels.PostableExtendedRuleNode{rule1},
	}
	group2 := apimodels.PostableRuleGroupConfig{
		Name:     "test-group-2",
		Interval: 60,
		Rules:    []apimodels.PostableExtendedRuleNode{rule2},
	}
	group3 := apimodels.PostableRuleGroupConfig{
		Name:     "test-group-3",
		Interval: 60,
		Rules:    []apimodels.PostableExtendedRuleNode{rule3},
	}
	adminClient.PostRulesGroup(t, folder1UID, &group1, false)
	adminClient.PostRulesGroup(t, folder2UID, &group2, false)
	adminClient.PostRulesGroup(t, folder3UID, &group3, false)

	t.Run("admin, editor, and viewer should be able to see all rules in a given folder", func(t *testing.T) {
		// admin
		rules, status, _ := adminClient.GetAllRulesGroupInFolderWithStatus(t, folder1UID)
		require.Equal(t, http.StatusAccepted, status)
		require.Len(t, rules, 1)

		// editor
		rules, status, _ = editorClient.GetAllRulesGroupInFolderWithStatus(t, folder1UID)
		require.Equal(t, http.StatusAccepted, status)
		require.Len(t, rules, 1)

		// viewer
		rules, status, _ = viewerClient.GetAllRulesGroupInFolderWithStatus(t, folder1UID)
		require.Equal(t, http.StatusAccepted, status)
		require.Len(t, rules, 1)
	})

	t.Run("admin should be able to access restricted folder, but no one else can", func(t *testing.T) {
		restrictedFolderUID := "restricted-folder"
		adminClient.CreateFolder(t, restrictedFolderUID, "Restricted Folder")
		restrictedRule := createTestAlertRule("Restricted Rule", restrictedFolderUID)
		restrictedGroup := apimodels.PostableRuleGroupConfig{
			Name:     "restricted-group",
			Interval: 60,
			Rules:    []apimodels.PostableExtendedRuleNode{restrictedRule},
		}
		adminClient.PostRulesGroup(t, restrictedFolderUID, &restrictedGroup, false)
		setFolderPermissions(t, grafanaListedAddr, restrictedFolderUID, []map[string]interface{}{
			{
				"userId":     1,
				"permission": 4,
			},
		})

		// admin ok
		_, status, _ := adminClient.GetAllRulesGroupInFolderWithStatus(t, restrictedFolderUID)
		require.Equal(t, http.StatusAccepted, status)

		// editor and viewer forbidden
		_, status, _ = editorClient.GetAllRulesGroupInFolderWithStatus(t, restrictedFolderUID)
		require.Equal(t, http.StatusForbidden, status)

		_, status, _ = viewerClient.GetAllRulesGroupInFolderWithStatus(t, restrictedFolderUID)
		require.Equal(t, http.StatusForbidden, status)
	})

	t.Run("errors when a folder does not exist", func(t *testing.T) {
		_, status, _ := adminClient.GetAllRulesGroupInFolderWithStatus(t, "non-existent-folder")
		// even if a folder does not exist, it will return a forbidden error (so users cannot enumerate folders)
		require.Equal(t, http.StatusForbidden, status)
	})

	t.Run("permissions are respected for nested folders", func(t *testing.T) {
		parentFolderUID := "parent-folder"
		childFolderUID := "child-folder"
		adminClient.CreateFolder(t, parentFolderUID, "Parent Folder")
		adminClient.CreateFolder(t, childFolderUID, "Child Folder", parentFolderUID)
		parentRule := createTestAlertRule("Parent Rule", parentFolderUID)
		parentGroup := apimodels.PostableRuleGroupConfig{
			Name:     "parent-group",
			Interval: 60,
			Rules:    []apimodels.PostableExtendedRuleNode{parentRule},
		}
		adminClient.PostRulesGroup(t, parentFolderUID, &parentGroup, false)
		childRule := createTestAlertRule("Child Rule", childFolderUID)
		childGroup := apimodels.PostableRuleGroupConfig{
			Name:     "child-group",
			Interval: 60,
			Rules:    []apimodels.PostableExtendedRuleNode{childRule},
		}
		adminClient.PostRulesGroup(t, childFolderUID, &childGroup, false)

		// allow admin to access parent folder
		setFolderPermissions(t, grafanaListedAddr, parentFolderUID, []map[string]interface{}{
			{
				"userId":     1,
				"permission": 4,
			},
		})

		// admin can get both folders
		allRules, status, _ := adminClient.GetAllRulesWithStatus(t)
		require.Equal(t, http.StatusOK, status)
		require.Contains(t, allRules, "Parent Folder")
		require.Contains(t, allRules, "Parent Folder/Child Folder")

		// editor cannot access either
		allRules, status, _ = editorClient.GetAllRulesWithStatus(t)
		require.Equal(t, http.StatusOK, status)
		require.NotContains(t, allRules, "Parent Folder")
		require.NotContains(t, allRules, "Parent Folder/Child Folder")

		// viewer cannot access either folder
		allRules, status, _ = viewerClient.GetAllRulesWithStatus(t)
		require.Equal(t, http.StatusOK, status)
		require.NotContains(t, allRules, "Parent Folder")
		require.NotContains(t, allRules, "Parent Folder/Child Folder")
	})

	t.Run("org separation", func(t *testing.T) {
		cfgProvider, err := configprovider.ProvideService(cfg)
		require.NoError(t, err)
		orgService, err := orgimpl.ProvideService(store, cfg, quotaimpl.ProvideService(store, cfgProvider))
		require.NoError(t, err)
		newOrg, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "Test Org 2"})
		require.NoError(t, err)
		createUser(t, store, cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			OrgID:          newOrg.ID,
			Password:       "other-admin",
			Login:          "other-admin-folder-perms",
		})
		otherOrgFolderUID := "other-org-folder"
		otherOrgClient := newAlertingApiClient(grafanaListedAddr, "other-admin-folder-perms", "other-admin")
		otherOrgClient.CreateFolder(t, otherOrgFolderUID, "Other Org Folder")
		otherOrgRule := createTestAlertRule("Other Org Rule", otherOrgFolderUID)
		otherOrgGroup := apimodels.PostableRuleGroupConfig{
			Name:     "other-org-group",
			Interval: 60,
			Rules:    []apimodels.PostableExtendedRuleNode{otherOrgRule},
		}
		otherOrgClient.PostRulesGroup(t, otherOrgFolderUID, &otherOrgGroup, false)

		// admin from org 1 cannot access org 2 alert rules
		allRules, status, _ := adminClient.GetAllRulesWithStatus(t)
		require.Equal(t, http.StatusOK, status)
		require.NotContains(t, allRules, otherOrgFolderUID)

		// admin from org 2 cannot access org 1 alert rules
		allRules, status, _ = otherOrgClient.GetAllRulesWithStatus(t)
		require.Equal(t, http.StatusOK, status)
		require.NotContains(t, allRules, folder1UID)
		require.NotContains(t, allRules, folder2UID)
		require.NotContains(t, allRules, folder3UID)
	})
}

func TestIntegration_NamespacingForPrometheusRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)
	store, cfg := env.SQLStore, env.Cfg
	orgID := int64(1)
	createUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		OrgID:          orgID,
		Password:       "editor",
		Login:          "editor",
	})
	createUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		OrgID:          orgID,
		Password:       "viewer",
		Login:          "viewer",
	})
	adminClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")
	editorClient := newAlertingApiClient(grafanaListedAddr, "editor", "editor")
	viewerClient := newAlertingApiClient(grafanaListedAddr, "viewer", "viewer")

	// create prometheus rules in 3 separate folders
	ds := adminClient.CreateDatasource(t, "prometheus")
	dsUID := ds.Body.Datasource.UID
	folder1UID := "prometheus-folder-1"
	folder2UID := "prometheus-folder-2"
	folder3UID := "prometheus-folder-3"
	adminClient.CreateFolder(t, folder1UID, "Prometheus Folder 1")
	adminClient.CreateFolder(t, folder2UID, "Prometheus Folder 2")
	adminClient.CreateFolder(t, folder3UID, "Prometheus Folder 3")
	duration1m := model.Duration(1 * 60 * 1000)
	prometheusRules1 := map[string][]apimodels.PrometheusRuleGroup{
		"Prometheus Folder 1": {
			{
				Name: "test-group-1",
				Rules: []apimodels.PrometheusRule{
					{
						Alert: "HighCPUUsage",
						Expr:  "cpu_usage > 80",
						For:   &duration1m,
						Labels: map[string]string{
							"severity": "warning",
						},
						Annotations: map[string]string{
							"summary": "High CPU usage detected",
						},
					},
				},
			},
		},
	}
	prometheusRules2 := map[string][]apimodels.PrometheusRuleGroup{
		"Prometheus Folder 2": {
			{
				Name: "test-group-2",
				Rules: []apimodels.PrometheusRule{
					{
						Alert: "HighMemoryUsage",
						Expr:  "memory_usage > 90",
						For:   &duration1m,
						Labels: map[string]string{
							"severity": "critical",
						},
						Annotations: map[string]string{
							"summary": "High memory usage detected",
						},
					},
				},
			},
		},
	}
	prometheusRules3 := map[string][]apimodels.PrometheusRuleGroup{
		"Prometheus Folder 3": {
			{
				Name: "test-group-3",
				Rules: []apimodels.PrometheusRule{
					{
						Alert: "DiskSpaceLow",
						Expr:  "disk_usage > 95",
						For:   &duration1m,
						Labels: map[string]string{
							"severity": "warning",
						},
						Annotations: map[string]string{
							"summary": "Disk space is running low",
						},
					},
				},
			},
		},
	}
	// then import them
	headers := map[string]string{
		"Content-Type":     "application/json",
		"X-Datasource-UID": dsUID,
	}
	adminClient.ConvertPrometheusPostRuleGroups(t, dsUID, prometheusRules1, headers)
	adminClient.ConvertPrometheusPostRuleGroups(t, dsUID, prometheusRules2, headers)
	adminClient.ConvertPrometheusPostRuleGroups(t, dsUID, prometheusRules3, headers)

	t.Run("admin, editor, and viewer should be able to get all Prometheus rules", func(t *testing.T) {
		// admin
		rules := adminClient.ConvertPrometheusGetAllRules(t, headers)
		require.Len(t, rules, 3)
		require.Contains(t, rules, "Prometheus Folder 1")
		require.Contains(t, rules, "Prometheus Folder 2")
		require.Contains(t, rules, "Prometheus Folder 3")

		// editor
		rules = editorClient.ConvertPrometheusGetAllRules(t, headers)
		require.Len(t, rules, 3)
		require.Contains(t, rules, "Prometheus Folder 1")
		require.Contains(t, rules, "Prometheus Folder 2")
		require.Contains(t, rules, "Prometheus Folder 3")

		// viewer
		rules = viewerClient.ConvertPrometheusGetAllRules(t, headers)
		require.Len(t, rules, 3)
		require.Contains(t, rules, "Prometheus Folder 1")
		require.Contains(t, rules, "Prometheus Folder 2")
		require.Contains(t, rules, "Prometheus Folder 3")
	})

	t.Run("only admin can view restricted folder", func(t *testing.T) {
		restrictedFolderUID := "restricted-prometheus-folder"
		adminClient.CreateFolder(t, restrictedFolderUID, "Restricted Prometheus Folder")
		restrictedPrometheusRules := map[string][]apimodels.PrometheusRuleGroup{
			"Restricted Prometheus Folder": {
				{
					Name: "restricted-group",
					Rules: []apimodels.PrometheusRule{
						{
							Alert: "RestrictedAlert",
							Expr:  "restricted_metric > 100",
							For:   &duration1m,
							Labels: map[string]string{
								"severity": "critical",
							},
						},
					},
				},
			},
		}
		adminClient.ConvertPrometheusPostRuleGroups(t, dsUID, restrictedPrometheusRules, headers)
		setFolderPermissions(t, grafanaListedAddr, restrictedFolderUID, []map[string]interface{}{
			{
				"userId":     1,
				"permission": 4,
			},
		})

		// admin can see the restricted folder
		rules := adminClient.ConvertPrometheusGetAllRules(t, headers)
		require.Contains(t, rules, "Restricted Prometheus Folder")

		// editor and viewer cannot
		rules = editorClient.ConvertPrometheusGetAllRules(t, headers)
		require.NotContains(t, rules, "Restricted Prometheus Folder")
		rules = viewerClient.ConvertPrometheusGetAllRules(t, headers)
		require.NotContains(t, rules, "Restricted Prometheus Folder")
	})

	t.Run("should maintain org separation for Prometheus rules", func(t *testing.T) {
		cfgProvider, err := configprovider.ProvideService(cfg)
		require.NoError(t, err)
		orgService, err := orgimpl.ProvideService(store, cfg, quotaimpl.ProvideService(store, cfgProvider))
		require.NoError(t, err)
		newOrg, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "Prometheus Test Org 2"})
		require.NoError(t, err)
		createUser(t, store, cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			OrgID:          newOrg.ID,
			Password:       "other-prometheus-admin",
			Login:          "other-prometheus-admin",
		})
		otherOrgClient := newAlertingApiClient(grafanaListedAddr, "other-prometheus-admin", "other-prometheus-admin")
		otherOrgDs := otherOrgClient.CreateDatasource(t, "prometheus")
		otherOrgDsUID := otherOrgDs.Body.Datasource.UID
		otherOrgFolderUID := "other-org-prometheus-folder"
		otherOrgClient.CreateFolder(t, otherOrgFolderUID, "Other Org Prometheus Folder")
		otherOrgPrometheusRules := map[string][]apimodels.PrometheusRuleGroup{
			"Other Org Prometheus Folder": {
				{
					Name: "other-org-group",
					Rules: []apimodels.PrometheusRule{
						{
							Alert: "OtherOrgAlert",
							Expr:  "other_org_metric > 75",
							For:   &duration1m,
						},
					},
				},
			},
		}
		otherOrgHeaders := map[string]string{
			"Content-Type":     "application/json",
			"X-Datasource-UID": otherOrgDsUID,
		}
		otherOrgClient.ConvertPrometheusPostRuleGroups(t, otherOrgDsUID, otherOrgPrometheusRules, otherOrgHeaders)

		// admin from org 1 cannot see org 2 rules
		rules := adminClient.ConvertPrometheusGetAllRules(t, headers)
		require.NotContains(t, rules, "Other Org Prometheus Folder")

		// admin from org 2 cannot see org 1 rules
		rules = otherOrgClient.ConvertPrometheusGetAllRules(t, otherOrgHeaders)
		require.NotContains(t, rules, "Prometheus Folder 1")
		require.NotContains(t, rules, "Prometheus Folder 2")
		require.NotContains(t, rules, "Prometheus Folder 3")
		require.Contains(t, rules, "Other Org Prometheus Folder")
	})
}

func createTestAlertRule(title, folderUID string) apimodels.PostableExtendedRuleNode {
	return apimodels.PostableExtendedRuleNode{
		GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
			Title:     title,
			Condition: "A",
			Data: []apimodels.AlertQuery{
				{
					RefID: "A",
					RelativeTimeRange: apimodels.RelativeTimeRange{
						From: 600,
						To:   0,
					},
					DatasourceUID: "-100",
					Model: json.RawMessage(`{
						"type": "math",
						"expression": "2 + 3 > 1"
					}`),
				},
			},
			NoDataState:  "NoData",
			ExecErrState: "Error",
		},
	}
}

func setFolderPermissions(t *testing.T, grafanaListedAddr string, folderUID string, permissions []map[string]interface{}) {
	t.Helper()

	permissionPayload := map[string]interface{}{
		"items": permissions,
	}

	payloadBytes, err := json.Marshal(permissionPayload)
	require.NoError(t, err)

	u := fmt.Sprintf("http://admin:admin@%s/api/folders/%s/permissions", grafanaListedAddr, folderUID)
	resp, err := http.Post(u, "application/json", bytes.NewBuffer(payloadBytes)) // nolint:gosec
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	err = resp.Body.Close()
	require.NoError(t, err)
}
