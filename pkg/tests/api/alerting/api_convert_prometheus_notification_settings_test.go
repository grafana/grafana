package alerting

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	notificationSettingsHeader = "X-Grafana-Alerting-Notification-Settings"
)

func TestIntegrationConvertPrometheusNotificationSettings(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Setup Grafana and its Database

	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableRecordingRules:  true,
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, path)

	adminClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	ds := adminClient.CreateDatasource(t, "prometheus")

	namespace := "test-notification-settings"
	namespaceUID := util.GenerateShortUID()
	adminClient.CreateFolder(t, namespaceUID, namespace)

	alertRuleGroup := apimodels.PrometheusRuleGroup{
		Name:     "test-group-notification-settings",
		Interval: prommodel.Duration(60 * time.Second),
		Rules: []apimodels.PrometheusRule{
			{
				Alert: "TestAlert",
				Expr:  "vector(1) > 0",
				For:   util.Pointer(prommodel.Duration(5 * time.Minute)),
				Labels: map[string]string{
					"severity": "critical",
				},
				Annotations: map[string]string{
					"summary": "Test alert with notification settings",
				},
			},
		},
	}

	t.Run("rules should use notification settings from header", func(t *testing.T) {
		receiver := "test-receiver"

		receiverSettings, err := simplejson.NewJson([]byte(`{
			"url":"https://localhost/webhook"
		}`))
		require.NoError(t, err)
		adminClient.EnsureReceiver(t,
			apimodels.EmbeddedContactPoint{
				Name:     receiver,
				Type:     "webhook",
				Settings: receiverSettings,
			},
		)

		groupBy := []string{"alertname", "instance", "job"}
		settings := apimodels.AlertRuleNotificationSettings{
			Receiver: receiver,
			GroupBy:  groupBy,
		}
		settingsJSON, err := json.Marshal(settings)
		require.NoError(t, err)

		headers := map[string]string{
			notificationSettingsHeader: string(settingsJSON),
		}
		adminClient.ConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, alertRuleGroup, headers)

		group, _, _ := adminClient.GetRulesGroupWithStatus(t, namespaceUID, alertRuleGroup.Name)

		require.Len(t, group.Rules, 1)
		rule := group.Rules[0]

		require.NotNil(t, rule.GrafanaManagedAlert.NotificationSettings)
		require.Equal(t, receiver, rule.GrafanaManagedAlert.NotificationSettings.Receiver)
		require.Equal(t, groupBy, rule.GrafanaManagedAlert.NotificationSettings.GroupBy)
	})

	t.Run("invalid JSON in notification settings header should return error", func(t *testing.T) {
		headers := map[string]string{
			notificationSettingsHeader: "{invalid json",
		}

		_, status, body := adminClient.RawConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, alertRuleGroup, headers)
		requireStatusCode(t, http.StatusBadRequest, status, body)
		require.Contains(t, body, "Invalid value for header X-Grafana-Alerting-Notification-Settings")
	})

	t.Run("empty receiver in notification settings should return error", func(t *testing.T) {
		settings := apimodels.AlertRuleNotificationSettings{
			Receiver: "",
			GroupBy:  []string{"alertname"},
		}
		settingsJSON, err := json.Marshal(settings)
		require.NoError(t, err)

		headers := map[string]string{
			notificationSettingsHeader: string(settingsJSON),
		}

		_, status, body := adminClient.RawConvertPrometheusPostRuleGroup(t, namespace, ds.Body.Datasource.UID, alertRuleGroup, headers)
		requireStatusCode(t, http.StatusBadRequest, status, body)
		require.Contains(t, body, "Invalid value for header X-Grafana-Alerting-Notification-Settings")
	})
}
