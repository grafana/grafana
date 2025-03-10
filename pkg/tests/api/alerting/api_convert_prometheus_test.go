package alerting

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
)

var (
	promGroup1 = apimodels.PrometheusRuleGroup{
		Name:     "test-group-1",
		Interval: prommodel.Duration(60 * time.Second),
		Rules: []apimodels.PrometheusRule{
			// Recording rule
			{
				Record: "test:requests:rate5m",
				Expr:   "sum(rate(test_requests_total[5m])) by (job)",
				Labels: map[string]string{
					"env":  "prod",
					"team": "infra",
				},
			},
			// Two alerting rules
			{
				Alert: "HighMemoryUsage",
				Expr:  "process_memory_usage > 80",
				For:   util.Pointer(prommodel.Duration(5 * time.Minute)),
				Labels: map[string]string{
					"severity": "warning",
					"team":     "alerting",
				},
				Annotations: map[string]string{
					"annotation-1": "value-1",
					"annotation-2": "value-2",
				},
			},
			{
				Alert: "ServiceDown",
				Expr:  "up == 0",
				For:   util.Pointer(prommodel.Duration(2 * time.Minute)),
				Labels: map[string]string{
					"severity": "critical",
				},
				Annotations: map[string]string{
					"annotation-1": "value-1",
				},
			},
		},
	}

	promGroup2 = apimodels.PrometheusRuleGroup{
		Name:     "test-group-2",
		Interval: prommodel.Duration(60 * time.Second),
		Rules: []apimodels.PrometheusRule{
			{
				Alert: "HighDiskUsage",
				Expr:  "disk_usage > 80",
				For:   util.Pointer(prommodel.Duration(1 * time.Minute)),
				Labels: map[string]string{
					"severity": "low",
					"team":     "alerting",
				},
				Annotations: map[string]string{
					"annotation-5": "value-5",
				},
			},
		},
	}

	promGroup3 = apimodels.PrometheusRuleGroup{
		Name:     "test-group-3",
		Interval: prommodel.Duration(60 * time.Second),
		Rules: []apimodels.PrometheusRule{
			{
				Alert: "ServiceDown",
				Expr:  "up == 0",
				For:   util.Pointer(prommodel.Duration(2 * time.Minute)),
				Labels: map[string]string{
					"severity": "critical",
				},
				Annotations: map[string]string{
					"annotation-1": "value-1",
				},
			},
		},
	}
)

func TestIntegrationConvertPrometheusEndpoints(t *testing.T) {
	runTest := func(t *testing.T, enableLokiPaths bool) {
		testinfra.SQLiteIntegrationTest(t)

		// Setup Grafana and its Database
		dir, gpath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			DisableAnonymous:      true,
			AppModeProduction:     true,
			EnableFeatureToggles:  []string{"alertingConversionAPI", "grafanaManagedRecordingRulesDatasources", "grafanaManagedRecordingRules"},
			EnableRecordingRules:  true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, gpath)

		// Create users to make authenticated requests
		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			Password:       "password",
			Login:          "admin",
		})
		apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "password")
		apiClient.prometheusConversionUseLokiPaths = enableLokiPaths

		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleViewer),
			Password:       "password",
			Login:          "viewer",
		})
		viewerClient := newAlertingApiClient(grafanaListedAddr, "viewer", "password")

		namespace1 := "test-namespace-1"
		namespace2 := "test-namespace-2"

		ds := apiClient.CreateDatasource(t, datasources.DS_PROMETHEUS)

		t.Run("create rule groups and get them back", func(t *testing.T) {
			apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup1, nil)
			apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup2, nil)

			// create a third group in a different namespace
			apiClient.ConvertPrometheusPostRuleGroup(t, namespace2, ds.Body.Datasource.UID, promGroup3, nil)

			// And a non-provisioned rule in another namespace
			namespace3UID := util.GenerateShortUID()
			apiClient.CreateFolder(t, namespace3UID, "folder")
			createRule(t, apiClient, namespace3UID)

			// Now get the first group
			group1 := apiClient.ConvertPrometheusGetRuleGroupRules(t, namespace1, promGroup1.Name, nil)
			require.Equal(t, promGroup1, group1)

			// Get namespace1
			ns1 := apiClient.ConvertPrometheusGetNamespaceRules(t, namespace1, nil)
			expectedNs1 := map[string][]apimodels.PrometheusRuleGroup{
				namespace1: {promGroup1, promGroup2},
			}
			require.Equal(t, expectedNs1, ns1)

			// Get all namespaces
			namespaces := apiClient.ConvertPrometheusGetAllRules(t, nil)
			expectedNamespaces := map[string][]apimodels.PrometheusRuleGroup{
				namespace1: {promGroup1, promGroup2},
				namespace2: {promGroup3},
			}
			require.Equal(t, expectedNamespaces, namespaces)
		})

		t.Run("without permissions to create folders cannot create rule groups either", func(t *testing.T) {
			_, status, raw := viewerClient.RawConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup1, nil)
			requireStatusCode(t, http.StatusForbidden, status, raw)
		})

		t.Run("delete one rule group", func(t *testing.T) {
			// Create three groups
			apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup1, nil)
			apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup2, nil)
			apiClient.ConvertPrometheusPostRuleGroup(t, namespace2, ds.Body.Datasource.UID, promGroup3, nil)

			// delete the first one
			apiClient.ConvertPrometheusDeleteRuleGroup(t, namespace1, promGroup1.Name, nil)

			// Check that the promGroup2 and promGroup3 are still there
			namespaces := apiClient.ConvertPrometheusGetAllRules(t, nil)
			expectedNamespaces := map[string][]apimodels.PrometheusRuleGroup{
				namespace1: {promGroup2},
				namespace2: {promGroup3},
			}
			require.Equal(t, expectedNamespaces, namespaces)

			// Delete the second namespace
			apiClient.ConvertPrometheusDeleteNamespace(t, namespace2, nil)

			// Check that only the first namespace is left
			namespaces = apiClient.ConvertPrometheusGetAllRules(t, nil)
			expectedNamespaces = map[string][]apimodels.PrometheusRuleGroup{
				namespace1: {promGroup2},
			}
			require.Equal(t, expectedNamespaces, namespaces)
		})
	}

	t.Run("with the mimirtool paths", func(t *testing.T) {
		runTest(t, false)
	})

	t.Run("with the cortextool Loki paths", func(t *testing.T) {
		runTest(t, true)
	})
}

func TestIntegrationConvertPrometheusEndpoints_UpdateRule(t *testing.T) {
	runTest := func(t *testing.T, enableLokiPaths bool) {
		testinfra.SQLiteIntegrationTest(t)

		// Setup Grafana and its Database
		dir, gpath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			DisableAnonymous:      true,
			AppModeProduction:     true,
			EnableFeatureToggles:  []string{"alertingConversionAPI", "grafanaManagedRecordingRulesDatasources", "grafanaManagedRecordingRules"},
			EnableRecordingRules:  true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, gpath)

		// Create a user to make authenticated requests
		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			Password:       "password",
			Login:          "admin",
		})
		apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "password")
		apiClient.prometheusConversionUseLokiPaths = enableLokiPaths

		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleViewer),
			Password:       "password",
			Login:          "viewer",
		})

		namespace1 := "test-namespace-1"

		ds := apiClient.CreateDatasource(t, datasources.DS_PROMETHEUS)

		promGroup := apimodels.PrometheusRuleGroup{
			Name:     "test-group-for-an-update",
			Interval: prommodel.Duration(60 * time.Second),
			Rules: []apimodels.PrometheusRule{
				{
					Alert: "HighDiskUsage",
					Expr:  "disk_usage > 80",
					For:   util.Pointer(prommodel.Duration(1 * time.Minute)),
					Labels: map[string]string{
						"severity": "low",
						"team":     "alerting",
					},
					Annotations: map[string]string{
						"annotation-5": "value-5",
					},
				},
			},
		}

		t.Run("update a rule", func(t *testing.T) {
			// Create the rule group
			apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup, nil)

			// Now get the group
			group1 := apiClient.ConvertPrometheusGetRuleGroupRules(t, namespace1, promGroup.Name, nil)
			require.Equal(t, promGroup, group1)

			// Update the rule group interval
			promGroup.Interval = prommodel.Duration(30 * time.Second)
			// Update the query
			promGroup.Rules[0].Expr = "disk_usage > 90"
			// Labels, and annotations too
			promGroup.Rules[0].Labels["another-label"] = "something"
			promGroup.Rules[0].Annotations["another-annotation"] = "also-something"
			// Update the group
			apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup, nil)

			// Now get the group again and check that the rule group has been updated
			group1 = apiClient.ConvertPrometheusGetRuleGroupRules(t, namespace1, promGroup.Name, nil)
			require.Equal(t, promGroup, group1)
		})
	}

	t.Run("with the mimirtool paths", func(t *testing.T) {
		runTest(t, false)
	})

	t.Run("with the cortextool Loki paths", func(t *testing.T) {
		runTest(t, true)
	})
}

func TestIntegrationConvertPrometheusEndpoints_Conflict(t *testing.T) {
	runTest := func(t *testing.T, enableLokiPaths bool) {
		testinfra.SQLiteIntegrationTest(t)

		// Setup Grafana and its Database
		dir, gpath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			DisableAnonymous:      true,
			AppModeProduction:     true,
			EnableFeatureToggles:  []string{"alertingConversionAPI", "grafanaManagedRecordingRulesDatasources", "grafanaManagedRecordingRules"},
			EnableRecordingRules:  true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, gpath)

		// Create users to make authenticated requests
		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			Password:       "password",
			Login:          "admin",
		})
		apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "password")
		apiClient.prometheusConversionUseLokiPaths = enableLokiPaths

		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleViewer),
			Password:       "password",
			Login:          "viewer",
		})

		namespace1 := "test-namespace-1"

		ds := apiClient.CreateDatasource(t, datasources.DS_PROMETHEUS)

		t.Run("cannot overwrite a rule group with different provenance", func(t *testing.T) {
			// Create a rule group using the provisioning API and then try to overwrite it
			// using  the Prometheus Conversion API. It should fail because the provenance
			// we set for rules in these two APIs is different and we check that when updating.
			provisionedRuleGroup := apimodels.AlertRuleGroup{
				Title:     promGroup1.Name,
				Interval:  60,
				FolderUID: namespace1,
				Rules: []apimodels.ProvisionedAlertRule{
					{
						Title:        "Rule1",
						OrgID:        1,
						RuleGroup:    promGroup1.Name,
						Condition:    "A",
						NoDataState:  apimodels.Alerting,
						ExecErrState: apimodels.AlertingErrState,
						For:          prommodel.Duration(time.Duration(60) * time.Second),
						Data: []apimodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: apimodels.RelativeTimeRange{
									From: apimodels.Duration(time.Duration(5) * time.Hour),
									To:   apimodels.Duration(time.Duration(3) * time.Hour),
								},
								DatasourceUID: expr.DatasourceUID,
								Model:         json.RawMessage([]byte(`{"type":"math","expression":"2 + 3 \u003e 1"}`)),
							},
						},
					},
				},
			}

			// Create the folder
			apiClient.CreateFolder(t, namespace1, namespace1)
			// Create rule in the root folder using another API
			_, status, response := apiClient.CreateOrUpdateRuleGroupProvisioning(t, provisionedRuleGroup)
			require.Equalf(t, http.StatusOK, status, response)

			// Should fail to post the group
			_, status, body := apiClient.RawConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup1, nil)
			requireStatusCode(t, http.StatusConflict, status, body)
		})
	}

	t.Run("with the mimirtool paths", func(t *testing.T) {
		runTest(t, false)
	})

	t.Run("with the cortextool Loki paths", func(t *testing.T) {
		runTest(t, true)
	})
}

func TestIntegrationConvertPrometheusEndpoints_CreatePausedRules(t *testing.T) {
	runTest := func(t *testing.T, enableLokiPaths bool) {
		testinfra.SQLiteIntegrationTest(t)

		// Setup Grafana and its Database
		dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			DisableAnonymous:      true,
			AppModeProduction:     true,
			EnableFeatureToggles:  []string{"alertingConversionAPI", "grafanaManagedRecordingRulesDatasources", "grafanaManagedRecordingRules"},
			EnableRecordingRules:  true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

		// Create users to make authenticated requests
		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			Password:       "password",
			Login:          "admin",
		})
		apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "password")
		apiClient.prometheusConversionUseLokiPaths = enableLokiPaths

		ds := apiClient.CreateDatasource(t, datasources.DS_PROMETHEUS)

		namespace1 := "test-namespace-1"

		namespace1UID := util.GenerateShortUID()
		apiClient.CreateFolder(t, namespace1UID, namespace1)

		t.Run("when pausing header is set, rules should be paused", func(t *testing.T) {
			tests := []struct {
				name            string
				recordingPaused bool
				alertPaused     bool
			}{
				{
					name:            "do not pause rules",
					recordingPaused: false,
					alertPaused:     false,
				},
				{
					name:            "pause recording rules",
					recordingPaused: true,
					alertPaused:     false,
				},
				{
					name:            "pause alert rules",
					recordingPaused: false,
					alertPaused:     true,
				},
				{
					name:            "pause both recording and alert rules",
					recordingPaused: true,
					alertPaused:     true,
				},
			}

			for _, tc := range tests {
				t.Run(tc.name, func(t *testing.T) {
					headers := map[string]string{}
					if tc.recordingPaused {
						headers["X-Grafana-Alerting-Recording-Rules-Paused"] = "true"
					}
					if tc.alertPaused {
						headers["X-Grafana-Alerting-Alert-Rules-Paused"] = "true"
					}

					apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup1, headers)

					gr, _, _ := apiClient.GetRulesGroupWithStatus(t, namespace1UID, promGroup1.Name)

					require.Len(t, gr.Rules, 3)

					pausedRecordingRules := 0
					pausedAlertRules := 0

					for _, rule := range gr.Rules {
						if rule.GrafanaManagedAlert.IsPaused {
							if rule.GrafanaManagedAlert.Record != nil {
								pausedRecordingRules++
							} else {
								pausedAlertRules++
							}
						}
					}

					if tc.recordingPaused {
						require.Equal(t, 1, pausedRecordingRules)
					} else {
						require.Equal(t, 0, pausedRecordingRules)
					}

					if tc.alertPaused {
						require.Equal(t, 2, pausedAlertRules)
					} else {
						require.Equal(t, 0, pausedAlertRules)
					}
				})
			}
		})
	}

	t.Run("with the mimirtool paths", func(t *testing.T) {
		runTest(t, false)
	})

	t.Run("with the cortextool Loki paths", func(t *testing.T) {
		runTest(t, true)
	})
}

func TestIntegrationConvertPrometheusEndpoints_FolderUIDHeader(t *testing.T) {
	runTest := func(t *testing.T, enableLokiPaths bool) {
		testinfra.SQLiteIntegrationTest(t)

		folderUIDHeader := "X-Grafana-Alerting-Folder-UID"

		// Setup Grafana and its Database
		dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			DisableAnonymous:      true,
			AppModeProduction:     true,
			EnableFeatureToggles:  []string{"alertingConversionAPI", "grafanaManagedRecordingRulesDatasources", "grafanaManagedRecordingRules"},
			EnableRecordingRules:  true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			Password:       "password",
			Login:          "admin",
		})
		apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "password")
		apiClient.prometheusConversionUseLokiPaths = enableLokiPaths

		ds := apiClient.CreateDatasource(t, datasources.DS_PROMETHEUS)

		// Create a parent folder
		parentFolderUID := util.GenerateShortUID()
		parentFolderTitle := "parent-folder"
		apiClient.CreateFolder(t, parentFolderUID, parentFolderTitle)

		// Create a child folder inside the parent folder
		childFolderUID := util.GenerateShortUID()
		childFolderTitle := "child-folder"
		apiClient.CreateFolder(t, childFolderUID, childFolderTitle, parentFolderUID)

		// Create another folder in root
		otherFolderUID := util.GenerateShortUID()
		otherFolderTitle := "other-folder"
		apiClient.CreateFolder(t, otherFolderUID, otherFolderTitle)

		t.Run("create and delete rule groups with folder UID header", func(t *testing.T) {
			// Post the namespace to parentFolderUID, it should create a new folder with the namespace name,
			// and put the rule group in it.
			headers := map[string]string{
				folderUIDHeader: parentFolderUID,
			}
			apiClient.ConvertPrometheusPostRuleGroup(t, childFolderTitle, ds.Body.Datasource.UID, promGroup1, headers)

			// Check that it's not visible when we get all namespaces from the root.
			namespaces := apiClient.ConvertPrometheusGetAllRules(t, nil)
			require.Empty(t, namespaces)

			// Post the group2 to the root, it should create a new folder with the namespace name.
			apiClient.ConvertPrometheusPostRuleGroup(t, otherFolderTitle, ds.Body.Datasource.UID, promGroup2, nil)

			// Now we should have:
			// - parentFolderUID/child-folder/test-group-1
			// - other-folder/test-group-2

			// Verify the rule group was created in the child folder
			//
			// First try to get the group in the root folder, it should not be found
			_, status, resp := apiClient.RawConvertPrometheusGetRuleGroupRules(t, childFolderTitle, promGroup1.Name, nil)
			require.Equal(t, http.StatusNotFound, status, resp)
			// Now try to get the group in the child folder
			group1 := apiClient.ConvertPrometheusGetRuleGroupRules(t, childFolderTitle, promGroup1.Name, headers)
			require.Equal(t, promGroup1, group1)

			// Verify the rule group was created in the other folder
			group2 := apiClient.ConvertPrometheusGetRuleGroupRules(t, otherFolderTitle, promGroup2.Name, nil)
			require.Equal(t, promGroup2, group2)
		})

		t.Run("empty folder UID header defaults to root", func(t *testing.T) {
			// Create a folder at root level
			rootFolderUID := util.GenerateShortUID()
			rootFolderTitle := "root-folder"
			apiClient.CreateFolder(t, rootFolderUID, rootFolderTitle)

			// Use empty folder UID header which should default to root
			headers := map[string]string{
				folderUIDHeader: "",
			}

			apiClient.ConvertPrometheusPostRuleGroup(t, rootFolderTitle, ds.Body.Datasource.UID, promGroup3, headers)

			// Verify the rule group was created
			group := apiClient.ConvertPrometheusGetRuleGroupRules(t, rootFolderTitle, promGroup3.Name, headers)
			require.Equal(t, promGroup3, group)
		})
	}

	t.Run("with the mimirtool paths", func(t *testing.T) {
		runTest(t, false)
	})

	t.Run("with the cortextool Loki paths", func(t *testing.T) {
		runTest(t, true)
	})
}

func TestIntegrationConvertPrometheusEndpoints_Delete(t *testing.T) {
	runTest := func(t *testing.T, enableLokiPaths bool) {
		testinfra.SQLiteIntegrationTest(t)

		// Setup Grafana and its Database
		dir, gpath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			DisableAnonymous:      true,
			AppModeProduction:     true,
			EnableFeatureToggles:  []string{"alertingConversionAPI", "grafanaManagedRecordingRulesDatasources", "grafanaManagedRecordingRules"},
			EnableRecordingRules:  true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, gpath)

		// Create users with different permissions
		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			Password:       "password",
			Login:          "admin",
		})
		adminClient := newAlertingApiClient(grafanaListedAddr, "admin", "password")
		adminClient.prometheusConversionUseLokiPaths = enableLokiPaths

		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleEditor),
			Password:       "password",
			Login:          "editor",
		})
		editorClient := newAlertingApiClient(grafanaListedAddr, "editor", "password")
		editorClient.prometheusConversionUseLokiPaths = enableLokiPaths

		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleViewer),
			Password:       "password",
			Login:          "viewer",
		})
		viewerClient := newAlertingApiClient(grafanaListedAddr, "viewer", "password")
		viewerClient.prometheusConversionUseLokiPaths = enableLokiPaths

		// Create a user with no access
		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleNone),
			Password:       "password",
			Login:          "no-role-user",
		})
		noRoleClient := newAlertingApiClient(grafanaListedAddr, "no-role-user", "password")
		noRoleClient.prometheusConversionUseLokiPaths = enableLokiPaths

		ds := adminClient.CreateDatasource(t, datasources.DS_PROMETHEUS)

		t.Run("delete non-existent namespace returns 404", func(t *testing.T) {
			nonExistentNamespace := "non-existent-namespace-" + util.GenerateShortUID()
			_, status, raw := adminClient.RawConvertPrometheusDeleteNamespace(t, nonExistentNamespace, nil)
			requireStatusCode(t, http.StatusNotFound, status, raw)
		})

		t.Run("delete non-existent rule group returns not found", func(t *testing.T) {
			nonExistentNamespace := "non-existent-namespace-" + util.GenerateShortUID()
			nonExistentGroup := "non-existent-group-" + util.GenerateShortUID()
			_, status, raw := adminClient.RawConvertPrometheusDeleteRuleGroup(t, nonExistentNamespace, nonExistentGroup, nil)
			requireStatusCode(t, http.StatusNotFound, status, raw)
		})

		t.Run("delete rule group from existing namespace that has no rule groups", func(t *testing.T) {
			// Create a namespace but don't add any rule groups to it
			emptyNamespace := "empty-namespace-" + util.GenerateShortUID()
			emptyNamespaceUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, emptyNamespaceUID, emptyNamespace)

			// Try to delete a non-existent rule group from that namespace
			nonExistentGroup := "non-existent-group-" + util.GenerateShortUID()
			_, status, raw := adminClient.RawConvertPrometheusDeleteRuleGroup(t, emptyNamespace, nonExistentGroup, nil)
			requireStatusCode(t, http.StatusNotFound, status, raw)
		})

		t.Run("delete rule group then verify it's gone", func(t *testing.T) {
			// Create namespace and rule group
			namespace := "test-namespace-delete-" + util.GenerateShortUID()
			namespaceUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, namespaceUID, namespace)

			// Create rule group
			adminClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup1, nil)

			// Verify the rule group exists
			group := adminClient.ConvertPrometheusGetRuleGroupRules(t, namespace, promGroup1.Name, nil)
			require.Equal(t, promGroup1.Name, group.Name)

			// Delete the rule group
			adminClient.ConvertPrometheusDeleteRuleGroup(t, namespace, promGroup1.Name, nil)

			// Verify the rule group is gone
			_, status, _ := adminClient.RawConvertPrometheusGetRuleGroupRules(t, namespace, promGroup1.Name, nil)
			require.Equal(t, http.StatusNotFound, status)
		})

		t.Run("delete namespace then verify it's empty", func(t *testing.T) {
			// Create namespace with two rule groups
			namespace := "test-namespace-delete-all-" + util.GenerateShortUID()
			namespaceUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, namespaceUID, namespace)

			// Create rule groups
			adminClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup1, nil)
			adminClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup2, nil)

			// Verify the namespace has rule groups
			groups := adminClient.ConvertPrometheusGetNamespaceRules(t, namespace, nil)
			require.ElementsMatch(t, groups[namespace], []apimodels.PrometheusRuleGroup{promGroup1, promGroup2})

			// Delete the namespace
			adminClient.ConvertPrometheusDeleteNamespace(t, namespace, nil)

			// Verify the namespace is empty
			namespaces := adminClient.ConvertPrometheusGetAllRules(t, nil)
			_, exists := namespaces[namespace]
			require.False(t, exists)
		})

		t.Run("delete specific rule group leaves other groups intact", func(t *testing.T) {
			// Create namespace with two rule groups
			namespace := "test-namespace-delete-one-" + util.GenerateShortUID()
			namespaceUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, namespaceUID, namespace)

			// Create rule groups
			adminClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup1, nil)
			adminClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup2, nil)

			// Delete one rule group
			adminClient.ConvertPrometheusDeleteRuleGroup(t, namespace, promGroup1.Name, nil)

			// Verify the other rule group still exists
			groups := adminClient.ConvertPrometheusGetNamespaceRules(t, namespace, nil)
			require.ElementsMatch(t, groups[namespace], []apimodels.PrometheusRuleGroup{promGroup2})
		})

		t.Run("viewer cannot delete rule groups", func(t *testing.T) {
			// Create namespace and rule group as admin
			namespace := "test-namespace-viewer-" + util.GenerateShortUID()
			namespaceUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, namespaceUID, namespace)

			adminClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup1, nil)

			// Try to delete as viewer - this should return 403 Forbidden
			_, status, body := viewerClient.RawConvertPrometheusDeleteRuleGroup(t, namespace, promGroup1.Name, nil)
			requireStatusCode(t, http.StatusForbidden, status, body)

			// Verify the rule group still exists
			group := adminClient.ConvertPrometheusGetRuleGroupRules(t, namespace, promGroup1.Name, nil)
			require.Equal(t, promGroup1.Name, group.Name)
		})

		t.Run("viewer cannot delete namespaces", func(t *testing.T) {
			// Create namespace and rule group as admin
			namespace := "test-namespace-viewer-ns-" + util.GenerateShortUID()
			namespaceUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, namespaceUID, namespace)

			adminClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup1, nil)

			// Try to delete as viewer - this should return 403 Forbidden
			_, status, body := viewerClient.RawConvertPrometheusDeleteNamespace(t, namespace, nil)
			requireStatusCode(t, http.StatusForbidden, status, body)

			// Verify the namespace still exists
			namespaces := adminClient.ConvertPrometheusGetAllRules(t, nil)
			_, exists := namespaces[namespace]
			require.True(t, exists)
		})

		t.Run("deleting rule group with nested folder structure using header", func(t *testing.T) {
			// Create parent folder
			parentFolder := "parent-folder-" + util.GenerateShortUID()
			parentFolderUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, parentFolderUID, parentFolder)

			// Create child folder inside parent
			childFolder := "child-folder-" + util.GenerateShortUID()
			childFolderUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, childFolderUID, childFolder, parentFolderUID)

			// Create rule group in child folder
			headers := map[string]string{
				"X-Grafana-Alerting-Folder-UID": parentFolderUID,
			}
			adminClient.ConvertPrometheusPostRuleGroup(t, childFolder, ds.Body.Datasource.UID, promGroup1, headers)

			// Verify the rule group exists
			group := adminClient.ConvertPrometheusGetRuleGroupRules(t, childFolder, promGroup1.Name, headers)
			require.Equal(t, promGroup1.Name, group.Name)

			// Delete the rule group
			adminClient.ConvertPrometheusDeleteRuleGroup(t, childFolder, promGroup1.Name, headers)

			// Verify the rule group is gone
			_, status, _ := adminClient.RawConvertPrometheusGetRuleGroupRules(t, childFolder, promGroup1.Name, headers)
			require.Equal(t, http.StatusNotFound, status)
		})

		t.Run("deleting namespace with nested folder structure using header", func(t *testing.T) {
			// Create parent folder
			parentFolder := "parent-folder-ns-" + util.GenerateShortUID()
			parentFolderUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, parentFolderUID, parentFolder)

			// Create child folder inside parent
			childFolder := "child-folder-ns-" + util.GenerateShortUID()
			childFolderUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, childFolderUID, childFolder, parentFolderUID)

			// Create rule groups in child folder
			headers := map[string]string{
				"X-Grafana-Alerting-Folder-UID": parentFolderUID,
			}
			adminClient.ConvertPrometheusPostRuleGroup(t, childFolder, ds.Body.Datasource.UID, promGroup1, headers)
			adminClient.ConvertPrometheusPostRuleGroup(t, childFolder, ds.Body.Datasource.UID, promGroup2, headers)

			// And a rule group in the parent folder
			adminClient.ConvertPrometheusPostRuleGroup(t, parentFolder, ds.Body.Datasource.UID, promGroup3, nil)

			// Verify both namespaces have rule groups
			groups := adminClient.ConvertPrometheusGetNamespaceRules(t, childFolder, headers)
			require.ElementsMatch(t, groups[childFolder], []apimodels.PrometheusRuleGroup{promGroup1, promGroup2})
			require.Empty(t, groups[parentFolder])

			parentGroups := adminClient.ConvertPrometheusGetNamespaceRules(t, parentFolder, nil)
			require.Empty(t, parentGroups[childFolder])
			require.ElementsMatch(t, parentGroups[parentFolder], []apimodels.PrometheusRuleGroup{promGroup3})

			// Delete the child namespace
			adminClient.ConvertPrometheusDeleteNamespace(t, childFolder, headers)

			// Verify the namespace is empty
			namespaces := adminClient.ConvertPrometheusGetAllRules(t, headers)
			_, exists := namespaces[childFolder]
			require.False(t, exists)

			// But the parent folder still has its rule group
			parentGroups = adminClient.ConvertPrometheusGetNamespaceRules(t, parentFolder, nil)
			require.ElementsMatch(t, parentGroups[parentFolder], []apimodels.PrometheusRuleGroup{promGroup3})
		})

		t.Run("editor can delete rule group they created", func(t *testing.T) {
			// Create namespace as admin
			namespace := "test-namespace-editor-" + util.GenerateShortUID()
			namespaceUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, namespaceUID, namespace)

			// Create rule group as editor
			editorClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup1, nil)

			// Verify the rule group exists
			group := editorClient.ConvertPrometheusGetRuleGroupRules(t, namespace, promGroup1.Name, nil)
			require.Equal(t, promGroup1.Name, group.Name)

			// Delete as editor
			editorClient.ConvertPrometheusDeleteRuleGroup(t, namespace, promGroup1.Name, nil)

			// Verify the rule group is gone
			_, status, _ := editorClient.RawConvertPrometheusGetRuleGroupRules(t, namespace, promGroup1.Name, nil)
			require.Equal(t, http.StatusNotFound, status)
		})

		t.Run("user with no role cannot delete rule groups", func(t *testing.T) {
			// Create namespace and rule group as admin
			namespace := "test-namespace-no-role-" + util.GenerateShortUID()
			namespaceUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, namespaceUID, namespace)

			adminClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup1, nil)

			_, status, body := noRoleClient.RawConvertPrometheusDeleteRuleGroup(t, namespace, promGroup1.Name, nil)
			requireStatusCode(t, http.StatusForbidden, status, body)
		})

		t.Run("user with no role cannot delete namespaces", func(t *testing.T) {
			// Create namespace and rule group as admin
			namespace := "test-namespace-no-role-ns-" + util.GenerateShortUID()
			namespaceUID := util.GenerateShortUID()
			adminClient.CreateFolder(t, namespaceUID, namespace)

			adminClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup1, nil)

			_, status, body := noRoleClient.RawConvertPrometheusDeleteNamespace(t, namespace, nil)
			requireStatusCode(t, http.StatusForbidden, status, body)
		})
	}

	t.Run("with the mimirtool paths", func(t *testing.T) {
		runTest(t, false)
	})

	t.Run("with the cortextool Loki paths", func(t *testing.T) {
		runTest(t, true)
	})
}
