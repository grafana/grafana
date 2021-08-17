package channels

import (
	"context"
	"encoding/json"
	"net/url"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

func TestSensuGoNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

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
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
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
							"ruleURL": "http://localhost/alerting/list",
						},
					},
					"output":   "**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
					"issued":   time.Now().Unix(),
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
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2"},
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
							"ruleURL": "http://localhost/alerting/list",
						},
					},
					"output":   "2 alerts are firing, 0 are resolved",
					"issued":   time.Now().Unix(),
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
			expInitError: `failed to validate receiver "Sensu Go" of type "sensugo": could not find URL property in settings`,
		}, {
			name: "Error in initing: missing API key",
			settings: `{
				"url": "http://sensu-api.local:8080"
			}`,
			expInitError: `failed to validate receiver "Sensu Go" of type "sensugo": could not find the API key property in settings`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "Sensu Go",
				Type:     "sensugo",
				Settings: settingsJSON,
			}

			sn, err := NewSensuGoNotifier(m, tmpl)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			body := ""
			bus.AddHandlerCtx("test", func(ctx context.Context, webhook *models.SendWebhookSync) error {
				body = webhook.Body
				return nil
			})

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
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

			require.JSONEq(t, string(expBody), body)
		})
	}
}
