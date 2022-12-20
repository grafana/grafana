package channels

import (
	"context"
	"encoding/json"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/alerting/alerting/notifier/channels"

	"github.com/grafana/grafana/pkg/setting"
)

func TestVictoropsNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	images := newFakeImageStore(2)

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
			name:     "A single alert with image",
			settings: `{"url": "http://localhost"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh", "__alertImageToken__": "test-image-1"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"alert_url":           "http://localhost/alerting/list",
				"entity_display_name": "[FIRING:1]  (val1)",
				"entity_id":           "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733",
				"image_url":           "https://www.example.com/test-image-1.jpg",
				"message_type":        "CRITICAL",
				"monitoring_tool":     "Grafana v" + setting.BuildVersion,
				"state_message":       "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
			},
			expMsgError: nil,
		}, {
			name:     "Multiple alerts with images",
			settings: `{"url": "http://localhost"}`,
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
			expMsg: map[string]interface{}{
				"alert_url":           "http://localhost/alerting/list",
				"entity_display_name": "[FIRING:2]  ",
				"entity_id":           "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733",
				"image_url":           "https://www.example.com/test-image-1.jpg",
				"message_type":        "CRITICAL",
				"monitoring_tool":     "Grafana v" + setting.BuildVersion,
				"state_message":       "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2\n",
			},
			expMsgError: nil,
		}, {
			name:     "Custom message",
			settings: `{"url": "http://localhost", "messageType": "Alerts firing: {{ len .Alerts.Firing }}"}`,
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
			expMsg: map[string]interface{}{
				"alert_url":           "http://localhost/alerting/list",
				"entity_display_name": "[FIRING:2]  ",
				"entity_id":           "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733",
				"message_type":        "ALERTS FIRING: 2",
				"monitoring_tool":     "Grafana v" + setting.BuildVersion,
				"state_message":       "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2\n",
			},
			expMsgError: nil,
		}, {
			name:     "Custom title and description",
			settings: `{"url": "http://localhost", "title": "Alerts firing: {{ len .Alerts.Firing }}", "description": "customDescription"}`,
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
			expMsg: map[string]interface{}{
				"alert_url":           "http://localhost/alerting/list",
				"entity_display_name": "Alerts firing: 2",
				"entity_id":           "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733",
				"message_type":        "CRITICAL",
				"monitoring_tool":     "Grafana v" + setting.BuildVersion,
				"state_message":       "customDescription",
			},
			expMsgError: nil,
		}, {
			name:     "Missing field in template",
			settings: `{"url": "http://localhost", "messageType": "custom template {{ .NotAField }} bad template"}`,
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
			expMsg: map[string]interface{}{
				"alert_url":           "http://localhost/alerting/list",
				"entity_display_name": "",
				"entity_id":           "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733",
				"message_type":        "CUSTOM TEMPLATE ",
				"monitoring_tool":     "Grafana v" + setting.BuildVersion,
				"state_message":       "",
			},
			expMsgError: nil,
		}, {
			name:     "Invalid template",
			settings: `{"url": "http://localhost", "messageType": "custom template {{ {.NotAField }} bad template"}`,
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
			expMsg: map[string]interface{}{
				"alert_url":           "http://localhost/alerting/list",
				"entity_display_name": "",
				"entity_id":           "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733",
				"message_type":        "CRITICAL",
				"monitoring_tool":     "Grafana v" + setting.BuildVersion,
				"state_message":       "",
			},
			expMsgError: nil,
		}, {
			name:         "Error in initing, no URL",
			settings:     `{}`,
			expInitError: `could not find victorops url property in settings`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON := json.RawMessage(c.settings)

			m := &channels.NotificationChannelConfig{
				Name:     "victorops_testing",
				Type:     "victorops",
				Settings: settingsJSON,
			}

			webhookSender := mockNotificationService()

			fc := channels.FactoryConfig{
				Config:              m,
				NotificationService: webhookSender,
				ImageStore:          images,
				Template:            tmpl,
				Logger:              &channels.FakeLogger{},
			}

			pn, err := NewVictoropsNotifier(fc)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

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

			require.NotEmpty(t, webhookSender.Webhook.URL)

			// Remove the non-constant timestamp
			data := make(map[string]interface{})
			err = json.Unmarshal([]byte(webhookSender.Webhook.Body), &data)
			require.NoError(t, err)
			delete(data, "timestamp")
			b, err := json.Marshal(data)
			require.NoError(t, err)
			body := string(b)

			expJson, err := json.Marshal(c.expMsg)
			require.NoError(t, err)
			require.JSONEq(t, string(expJson), body)
		})
	}
}
