package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestWebhookNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	orgID := int64(1)

	cases := []struct {
		name     string
		settings string
		alerts   []*types.Alert

		expMsg        *WebhookMessage
		expUrl        string
		expUsername   string
		expPassword   string
		expHeaders    map[string]string
		expHttpMethod string
		expInitError  string
		expMsgError   error
	}{
		{
			name:     "Default config with one alert with custom message",
			settings: `{"url": "http://localhost/test", "message": "Custom message"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expUrl:        "http://localhost/test",
			expHttpMethod: "POST",
			expMsg: &WebhookMessage{
				ExtendedData: &ExtendedData{
					Receiver: "my_receiver",
					Status:   "firing",
					Alerts: ExtendedAlerts{
						{
							Status: "firing",
							Labels: template.KV{
								"alertname": "alert1",
								"lbl1":      "val1",
							},
							Annotations: template.KV{
								"ann1": "annv1",
							},
							Fingerprint:  "fac0861a85de433a",
							DashboardURL: "http://localhost/d/abcd",
							PanelURL:     "http://localhost/d/abcd?viewPanel=efgh",
							SilenceURL:   "http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1",
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
				Message:  "Custom message",
				OrgID:    orgID,
			},
			expMsgError: nil,
			expHeaders:  map[string]string{},
		},
		{
			name: "Custom config with multiple alerts with custom title",
			settings: `{
				"url": "http://localhost/test1",
				"title": "Alerts firing: {{ len .Alerts.Firing }}",
				"username": "user1",
				"password": "mysecret",
				"httpMethod": "PUT",
				"maxAlerts": "2"
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
			expMsg: &WebhookMessage{
				ExtendedData: &ExtendedData{
					Receiver: "my_receiver",
					Status:   "firing",
					Alerts: ExtendedAlerts{
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
							SilenceURL:  "http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1",
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
							SilenceURL:  "http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2",
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
				Title:           "Alerts firing: 2",
				State:           "alerting",
				Message:         "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2\n",
				OrgID:           orgID,
			},
			expMsgError: nil,
			expHeaders:  map[string]string{},
		},
		{
			name:     "Default config, template variables in URL",
			settings: `{"url": "http://localhost/test?numAlerts={{len .Alerts}}&status={{.Status}}"}`,
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
			expUrl:        "http://localhost/test?numAlerts=2&status=firing",
			expHttpMethod: "POST",
			expMsg: &WebhookMessage{
				ExtendedData: &ExtendedData{
					Receiver: "my_receiver",
					Status:   "firing",
					Alerts: ExtendedAlerts{
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
							SilenceURL:  "http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1",
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
							SilenceURL:  "http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2",
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
				TruncatedAlerts: 0,
				Title:           "[FIRING:2]  ",
				State:           "alerting",
				Message:         "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2\n",
				OrgID:           orgID,
			},
			expMsgError: nil,
			expHeaders:  map[string]string{},
		},
		{
			name: "with Authorization set",
			settings: `{
				"url": "http://localhost/test1",
				"authorization_credentials": "mysecret",
				"httpMethod": "POST",
				"maxAlerts": 2
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: &WebhookMessage{
				ExtendedData: &ExtendedData{
					Receiver: "my_receiver",
					Status:   "firing",
					Alerts: ExtendedAlerts{
						{
							Status: "firing",
							Labels: template.KV{
								"alertname": "alert1",
								"lbl1":      "val1",
							},
							Annotations: template.KV{
								"ann1": "annv1",
							},
							Fingerprint:  "fac0861a85de433a",
							DashboardURL: "http://localhost/d/abcd",
							PanelURL:     "http://localhost/d/abcd?viewPanel=efgh",
							SilenceURL:   "http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1",
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
				Message:  "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
				OrgID:    orgID,
			},
			expUrl:        "http://localhost/test1",
			expHttpMethod: "POST",
			expHeaders:    map[string]string{"Authorization": "Bearer mysecret"},
		},
		{
			name:     "bad template in url",
			settings: `{"url": "http://localhost/test1?numAlerts={{len Alerts}}"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsgError: fmt.Errorf("template: :1: function \"Alerts\" not defined"),
		},
		{
			name: "with both HTTP basic auth and Authorization Header set",
			settings: `{
				"url": "http://localhost/test1",
				"username": "user1",
				"password": "mysecret",
				"authorization_credentials": "mysecret",
				"httpMethod": "POST",
				"maxAlerts": "2"
			}`,
			expInitError: "both HTTP Basic Authentication and Authorization Header are set, only 1 is permitted",
		},
		{
			name:         "Error in initing",
			settings:     `{}`,
			expInitError: `required field 'url' is not specified`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON := json.RawMessage(c.settings)
			secureSettings := make(map[string][]byte)

			m := &NotificationChannelConfig{
				OrgID:          orgID,
				Name:           "webhook_testing",
				Type:           "webhook",
				Settings:       settingsJSON,
				SecureSettings: secureSettings,
			}

			webhookSender := mockNotificationService()

			fc := FactoryConfig{
				Config:              m,
				NotificationService: webhookSender,
				DecryptFunc: func(ctx context.Context, sjd map[string][]byte, key string, fallback string) string {
					return fallback
				},
				ImageStore: &UnavailableImageStore{},
				Template:   tmpl,
				Logger:     &FakeLogger{},
			}

			pn, err := buildWebhookNotifier(fc)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

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

			require.JSONEq(t, string(expBody), webhookSender.Webhook.Body)
			require.Equal(t, c.expUrl, webhookSender.Webhook.Url)
			require.Equal(t, c.expUsername, webhookSender.Webhook.User)
			require.Equal(t, c.expPassword, webhookSender.Webhook.Password)
			require.Equal(t, c.expHttpMethod, webhookSender.Webhook.HttpMethod)
			require.Equal(t, c.expHeaders, webhookSender.Webhook.HttpHeader)
		})
	}
}
