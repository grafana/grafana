package channels

import (
	"context"
	"encoding/json"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func TestWebhookNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name          string
		settings      string
		alerts        []*types.Alert
		expMsg        *webhookMessage
		expUrl        string
		expUsername   string
		expPassword   string
		expHttpMethod string
		expInitError  error
		expMsgError   error
	}{
		{
			name:     "Default config with one alert",
			settings: `{"url": "http://localhost/test"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
			},
			expUrl:        "http://localhost/test",
			expHttpMethod: "POST",
			expMsg: &webhookMessage{
				Data: &template.Data{
					Receiver: "my_receiver",
					Status:   "firing",
					Alerts: template.Alerts{
						{
							Status: "firing",
							Labels: template.KV{
								"alertname": "alert1",
								"lbl1":      "val1",
							},
							Annotations: template.KV{
								"ann1": "annv1",
							},
							Fingerprint: "fac0861a85de433a",
						},
					},
					GroupLabels: template.KV{
						"alertname": "",
					},
					CommonLabels: template.KV{
						"alertname": "alert1",
						"lbl1":      "val1",
					},
					CommonAnnotations: template.KV{
						"ann1": "annv1",
					},
					ExternalURL: "http://localhost",
				},
				Version:  "1",
				GroupKey: "alertname",
				Title:    "[FIRING:1]  (val1)",
				State:    "alerting",
				Message:  "\n**Firing**\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSource: \n\n\n\n\n",
			},
			expInitError: nil,
			expMsgError:  nil,
		}, {
			name: "Custom config with multiple alerts",
			settings: `{
				"url": "http://localhost/test1",
				"username": "user1",
				"password": "mysecret",
				"httpMethod": "PUT",
				"maxAlerts": 2
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
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val3"},
						Annotations: model.LabelSet{"ann1": "annv3"},
					},
				},
			},
			expUrl:        "http://localhost/test1",
			expHttpMethod: "PUT",
			expUsername:   "user1",
			expPassword:   "mysecret",
			expMsg: &webhookMessage{
				Data: &template.Data{
					Receiver: "my_receiver",
					Status:   "firing",
					Alerts: template.Alerts{
						{
							Status: "firing",
							Labels: template.KV{
								"alertname": "alert1",
								"lbl1":      "val1",
							},
							Annotations: template.KV{
								"ann1": "annv1",
							},
							Fingerprint: "fac0861a85de433a",
						}, {
							Status: "firing",
							Labels: template.KV{
								"alertname": "alert1",
								"lbl1":      "val2",
							},
							Annotations: template.KV{
								"ann1": "annv2",
							},
							Fingerprint: "fab6861a85d5eeb5",
						},
					},
					GroupLabels: template.KV{
						"alertname": "",
					},
					CommonLabels: template.KV{
						"alertname": "alert1",
					},
					CommonAnnotations: template.KV{},
					ExternalURL:       "http://localhost",
				},
				Version:         "1",
				GroupKey:        "alertname",
				TruncatedAlerts: 1,
				Title:           "[FIRING:2]  ",
				State:           "alerting",
				Message:         "\n**Firing**\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSource: \nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSource: \n\n\n\n\n",
			},
			expInitError: nil,
			expMsgError:  nil,
		}, {
			name:         "Error in initing",
			settings:     `{}`,
			expInitError: alerting.ValidationError{Reason: "Could not find url property in settings"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "webhook_testing",
				Type:     "webhook",
				Settings: settingsJSON,
			}

			pn, err := NewWebHookNotifier(m, tmpl)
			if c.expInitError != nil {
				require.Error(t, err)
				require.Equal(t, c.expInitError.Error(), err.Error())
				return
			}
			require.NoError(t, err)

			var payload *models.SendWebhookSync
			bus.AddHandlerCtx("test", func(ctx context.Context, webhook *models.SendWebhookSync) error {
				payload = webhook
				return nil
			})

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			ctx = notify.WithReceiverName(ctx, "my_receiver")
			ok, err := pn.Notify(ctx, c.alerts...)
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

			require.JSONEq(t, string(expBody), payload.Body)
			require.Equal(t, c.expUrl, payload.Url)
			require.Equal(t, c.expUsername, payload.User)
			require.Equal(t, c.expPassword, payload.Password)
			require.Equal(t, c.expHttpMethod, payload.HttpMethod)
		})
	}
}
