package channels

import (
	"context"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestKafkaNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	images := newFakeImageStore(2)

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
			name: "A single alert with image",
			settings: `{
				"kafkaRestProxy": "http://localhost",
				"kafkaTopic": "sometopic"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh", "__alertImageToken__": "test-image-1"},
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
						"contexts": [{"type": "image", "src": "https://www.example.com/test-image-1.jpg"}],
						"description": "[FIRING:1]  (val1)",
						"details": "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
						"incident_key": "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733"
					  }
					}
				  ]
				}`,
			expMsgError: nil,
		}, {
			name: "Multiple alerts with images",
			settings: `{
				"kafkaRestProxy": "http://localhost",
				"kafkaTopic": "sometopic"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__alertImageToken__": "test-image-1"},
					},
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2", "__alertImageToken__": "test-image-2"},
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
						"contexts": [{"type": "image", "src": "https://www.example.com/test-image-1.jpg"}, {"type": "image", "src": "https://www.example.com/test-image-2.jpg"}],
						"description": "[FIRING:2]  ",
						"details": "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2\n",
						"incident_key": "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733"
					  }
					}
				  ]
				}`,
			expMsgError: nil,
		}, {
			name:         "Endpoint missing",
			settings:     `{"kafkaTopic": "sometopic"}`,
			expInitError: `could not find kafka rest proxy endpoint property in settings`,
		}, {
			name:         "Topic missing",
			settings:     `{"kafkaRestProxy": "http://localhost"}`,
			expInitError: `could not find kafka topic property in settings`,
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

			webhookSender := mockNotificationService()
			cfg, err := NewKafkaConfig(m)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})

			pn := NewKafkaNotifier(cfg, images, webhookSender, tmpl)
			ok, err := pn.Notify(ctx, c.alerts...)
			if c.expMsgError != nil {
				require.False(t, ok)
				require.Error(t, err)
				require.Equal(t, c.expMsgError.Error(), err.Error())
				return
			}
			require.NoError(t, err)
			require.True(t, ok)

			require.Equal(t, c.expUrl, webhookSender.Webhook.Url)
			require.JSONEq(t, c.expMsg, webhookSender.Webhook.Body)
		})
	}
}
