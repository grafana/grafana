package channels

import (
	"context"
	"encoding/json"
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestSensuGoNotifier(t *testing.T) {
	constNow := time.Now()
	defer mockTimeNow(constNow)()

	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	images := newFakeImageStore(2)

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expMsg       map[string]interface{}
		expInitError string
		expMsgError  error
	}{
		{
			name:     "Default config with one alert",
			settings: `{"url": "http://sensu-api.local:8080", "apikey": "<apikey>"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"__alert_rule_uid__": "rule uid", "alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh", "__alertScreenshotToken__": "test-image-1"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"entity": map[string]interface{}{
					"metadata": map[string]interface{}{
						"name":      "default",
						"namespace": "default",
					},
				},
				"check": map[string]interface{}{
					"metadata": map[string]interface{}{
						"name": "default",
						"labels": map[string]string{
							"imageURL": "https://www.example.com/test-image-1.jpg",
							"ruleURL":  "http://localhost/alerting/list",
						},
					},
					"output":   "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
					"issued":   timeNow().Unix(),
					"interval": 86400,
					"status":   2,
					"handlers": nil,
				},
				"ruleUrl": "http://localhost/alerting/list",
			},
			expMsgError: nil,
		}, {
			name: "Custom config with multiple alerts",
			settings: `{
				"url": "http://sensu-api.local:8080",
				"entity": "grafana_instance_01",
				"check": "grafana_rule_0",
				"namespace": "namespace",
				"handler": "myhandler",
				"apikey": "<apikey>",
				"message": "{{ len .Alerts.Firing }} alerts are firing, {{ len .Alerts.Resolved }} are resolved"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"__alert_rule_uid__": "rule uid", "alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__alertScreenshotToken__": "test-image-1"},
					},
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2", "__alertScreenshotToken__": "test-image-2"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"entity": map[string]interface{}{
					"metadata": map[string]interface{}{
						"name":      "grafana_instance_01",
						"namespace": "namespace",
					},
				},
				"check": map[string]interface{}{
					"metadata": map[string]interface{}{
						"name": "grafana_rule_0",
						"labels": map[string]string{
							"imageURL": "https://www.example.com/test-image-1.jpg",
							"ruleURL":  "http://localhost/alerting/list",
						},
					},
					"output":   "2 alerts are firing, 0 are resolved",
					"issued":   timeNow().Unix(),
					"interval": 86400,
					"status":   2,
					"handlers": []string{"myhandler"},
				},
				"ruleUrl": "http://localhost/alerting/list",
			},
			expMsgError: nil,
		}, {
			name: "Error in initing: missing URL",
			settings: `{
				"apikey": "<apikey>"
			}`,
			expInitError: `could not find URL property in settings`,
		}, {
			name: "Error in initing: missing API key",
			settings: `{
				"url": "http://sensu-api.local:8080"
			}`,
			expInitError: `could not find the API key property in settings`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)
			secureSettings := make(map[string][]byte)

			m := &NotificationChannelConfig{
				Name:           "Sensu Go",
				Type:           "sensugo",
				Settings:       settingsJSON,
				SecureSettings: secureSettings,
			}

			webhookSender := mockNotificationService()
			secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
			decryptFn := secretsService.GetDecryptedValue
			cfg, err := NewSensuGoConfig(m, decryptFn)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			sn := NewSensuGoNotifier(cfg, images, webhookSender, tmpl)
			ok, err := sn.Notify(ctx, c.alerts...)
			if c.expMsgError != nil {
				require.False(t, ok)
				require.Error(t, err)
				require.Equal(t, c.expMsgError.Error(), err.Error())
				return
			}
			require.NoError(t, err)
			require.True(t, ok)

			expBody, err := json.Marshal(c.expMsg)
			require.NoError(t, err)

			require.JSONEq(t, string(expBody), webhookSender.Webhook.Body)
		})
	}
}
