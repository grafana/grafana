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
			EnableFeatureToggles:  []string{"alertingConversionAPI"},
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
			_, status, body := apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup1, nil)
			requireStatusCode(t, http.StatusAccepted, status, body)
			_, status, body = apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup2, nil)
			requireStatusCode(t, http.StatusAccepted, status, body)

			// create a third group in a different namespace
			_, status, body = apiClient.ConvertPrometheusPostRuleGroup(t, namespace2, ds.Body.Datasource.UID, promGroup3, nil)
			requireStatusCode(t, http.StatusAccepted, status, body)

			// And a non-provisioned rule in another namespace
			namespace3UID := util.GenerateShortUID()
			apiClient.CreateFolder(t, namespace3UID, "folder")
			createRule(t, apiClient, namespace3UID)

			// Now get the first group
			group1 := apiClient.ConvertPrometheusGetRuleGroupRules(t, namespace1, promGroup1.Name)
			require.Equal(t, promGroup1, group1)

			// Get namespace1
			ns1 := apiClient.ConvertPrometheusGetNamespaceRules(t, namespace1)
			expectedNs1 := map[string][]apimodels.PrometheusRuleGroup{
				namespace1: {promGroup1, promGroup2},
			}
			require.Equal(t, expectedNs1, ns1)

			// Get all namespaces
			namespaces := apiClient.ConvertPrometheusGetAllRules(t)
			expectedNamespaces := map[string][]apimodels.PrometheusRuleGroup{
				namespace1: {promGroup1, promGroup2},
				namespace2: {promGroup3},
			}
			require.Equal(t, expectedNamespaces, namespaces)
		})

		t.Run("without permissions to create folders cannot create rule groups either", func(t *testing.T) {
			_, status, raw := viewerClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup1, nil)
			requireStatusCode(t, http.StatusForbidden, status, raw)
		})

		t.Run("delete one rule group", func(t *testing.T) {
			_, status, body := apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup1, nil)
			requireStatusCode(t, http.StatusAccepted, status, body)
			_, status, body = apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup2, nil)
			requireStatusCode(t, http.StatusAccepted, status, body)
			_, status, body = apiClient.ConvertPrometheusPostRuleGroup(t, namespace2, ds.Body.Datasource.UID, promGroup3, nil)
			requireStatusCode(t, http.StatusAccepted, status, body)

			apiClient.ConvertPrometheusDeleteRuleGroup(t, namespace1, promGroup1.Name)

			// Check that the promGroup2 and promGroup3 are still there
			namespaces := apiClient.ConvertPrometheusGetAllRules(t)
			expectedNamespaces := map[string][]apimodels.PrometheusRuleGroup{
				namespace1: {promGroup2},
				namespace2: {promGroup3},
			}
			require.Equal(t, expectedNamespaces, namespaces)

			// Delete the second namespace
			apiClient.ConvertPrometheusDeleteNamespace(t, namespace2)

			// Check that only the first namespace is left
			namespaces = apiClient.ConvertPrometheusGetAllRules(t)
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
			EnableFeatureToggles:  []string{"alertingConversionAPI"},
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
			_, status, body := apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup, nil)
			requireStatusCode(t, http.StatusAccepted, status, body)

			// Now get the group
			group1 := apiClient.ConvertPrometheusGetRuleGroupRules(t, namespace1, promGroup.Name)
			require.Equal(t, promGroup, group1)

			// Update the rule group interval
			promGroup.Interval = prommodel.Duration(30 * time.Second)
			// Update the query
			promGroup.Rules[0].Expr = "disk_usage > 90"
			// Labels, and annotations too
			promGroup.Rules[0].Labels["another-label"] = "something"
			promGroup.Rules[0].Annotations["another-annotation"] = "also-something"
			// Update the group
			_, status, body = apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup, nil)
			requireStatusCode(t, http.StatusAccepted, status, body)

			// Now get the group again and check that the rule group has been updated
			group1 = apiClient.ConvertPrometheusGetRuleGroupRules(t, namespace1, promGroup.Name)
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
			EnableFeatureToggles:  []string{"alertingConversionAPI"},
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
			_, status, body := apiClient.ConvertPrometheusPostRuleGroup(t, namespace1, ds.Body.Datasource.UID, promGroup1, nil)
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
			EnableFeatureToggles:  []string{"alertingConversionAPI"},
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

		// Create users to make authenticated requests
		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			Password:       "password",
			Login:          "admin",
		})
		apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "password")

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
