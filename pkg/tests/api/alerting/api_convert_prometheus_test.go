package alerting

import (
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
)

func TestIntegrationConvertPrometheusEndpoints(t *testing.T) {
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

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "password",
		Login:          "admin",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "password")
	namespace := "test-namespace"

	promGroup1 := apimodels.PrometheusRuleGroup{
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

	promGroup2 := apimodels.PrometheusRuleGroup{
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

	ds := apiClient.CreateDatasource(t, datasources.DS_PROMETHEUS)

	t.Run("create two rule groups and get them back", func(t *testing.T) {
		apiClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup1, nil)
		apiClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup2, nil)

		ns, _, _ := apiClient.GetAllRulesWithStatus(t)

		require.Len(t, ns[namespace], 2)

		rulesByGroupName := map[string][]apimodels.GettableExtendedRuleNode{}
		for _, group := range ns[namespace] {
			rulesByGroupName[group.Name] = append(rulesByGroupName[group.Name], group.Rules...)
		}

		require.Len(t, rulesByGroupName[promGroup1.Name], 3)
		require.Len(t, rulesByGroupName[promGroup2.Name], 1)
	})

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
				apiClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, promGroup1, headers)

				ns, _, _ := apiClient.GetAllRulesWithStatus(t)

				rulesByGroupName := map[string][]apimodels.GettableExtendedRuleNode{}
				for _, group := range ns[namespace] {
					rulesByGroupName[group.Name] = append(rulesByGroupName[group.Name], group.Rules...)
				}

				require.Len(t, rulesByGroupName[promGroup1.Name], 3)

				pausedRecordingRules := 0
				pausedAlertRules := 0

				for _, rule := range rulesByGroupName[promGroup1.Name] {
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
