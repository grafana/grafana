package channels

import (
	"context"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

func TestKafkaNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name           string
		settings       string
		alerts         []*types.Alert
		expUrl, expMsg string
		expInitError   string
		expMsgError    error
	}{
		{
			name: "One alert",
			settings: `{
				"kafkaRestProxy": "http://localhost",
				"kafkaTopic": "sometopic"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expUrl: "http://localhost/topics/sometopic",
			expMsg: `{
				  "records": [
					{
					  "value": {
						"alert_state": "alerting",
						"client": "Grafana",
						"client_url": "http://localhost/alerting/list",
						"description": "[FIRING:1]  (val1)",
						"details": "**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
						"incident_key": "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733"
					  }
					}
				  ]
				}`,
			expMsgError: nil,
		}, {
			name: "Multiple alerts",
			settings: `{
				"kafkaRestProxy": "http://localhost",
				"kafkaTopic": "sometopic"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2"},
					},
				},
			},
			expUrl: "http://localhost/topics/sometopic",
			expMsg: `{
				  "records": [
					{
					  "value": {
						"alert_state": "alerting",
						"client": "Grafana",
						"client_url": "http://localhost/alerting/list",
						"description": "[FIRING:2]  ",
						"details": "**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\n\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval2\n",
						"incident_key": "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733"
					  }
					}
				  ]
				}`,
			expMsgError: nil,
		}, {
			name:         "Endpoint missing",
			settings:     `{"kafkaTopic": "sometopic"}`,
			expInitError: `failed to validate receiver "kafka_testing" of type "kafka": could not find kafka rest proxy endpoint property in settings`,
		}, {
			name:         "Topic missing",
			settings:     `{"kafkaRestProxy": "http://localhost"}`,
			expInitError: `failed to validate receiver "kafka_testing" of type "kafka": could not find kafka topic property in settings`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "kafka_testing",
				Type:     "kafka",
				Settings: settingsJSON,
			}

			pn, err := NewKafkaNotifier(m, tmpl)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			body := ""
			actUrl := ""
			bus.AddHandlerCtx("test", func(ctx context.Context, webhook *models.SendWebhookSync) error {
				body = webhook.Body
				actUrl = webhook.Url
				return nil
			})

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			ok, err := pn.Notify(ctx, c.alerts...)
			if c.expMsgError != nil {
				require.False(t, ok)
				require.Error(t, err)
				require.Equal(t, c.expMsgError.Error(), err.Error())
				return
			}
			require.NoError(t, err)
			require.True(t, ok)

			require.Equal(t, c.expUrl, actUrl)
			require.JSONEq(t, c.expMsg, body)
		})
	}
}
