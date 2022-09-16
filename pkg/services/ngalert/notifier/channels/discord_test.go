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

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDiscordNotifier(t *testing.T) {
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
			settings: `{"url": "http://localhost"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"content": "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
				"embeds": []interface{}{map[string]interface{}{
					"color": 1.4037554e+07,
					"footer": map[string]interface{}{
						"icon_url": "https://grafana.com/assets/img/fav32.png",
						"text":     "Grafana v" + setting.BuildVersion,
					},
					"title": "[FIRING:1]  (val1)",
					"url":   "http://localhost/alerting/list",
					"type":  "rich",
				}},
				"username": "Grafana",
			},
			expMsgError: nil,
		},
		{
			name: "Missing field in template",
			settings: `{
				"avatar_url": "https://grafana.com/assets/img/fav32.png",
				"url": "http://localhost",
				"message": "I'm a custom template {{ .NotAField }} bad template"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"avatar_url": "https://grafana.com/assets/img/fav32.png",
				"content":    "I'm a custom template ",
				"embeds": []interface{}{map[string]interface{}{
					"color": 1.4037554e+07,
					"footer": map[string]interface{}{
						"icon_url": "https://grafana.com/assets/img/fav32.png",
						"text":     "Grafana v" + setting.BuildVersion,
					},
					"title": "[FIRING:1]  (val1)",
					"url":   "http://localhost/alerting/list",
					"type":  "rich",
				}},
				"username": "Grafana",
			},
			expMsgError: nil,
		},
		{
			name: "Invalid message template",
			settings: `{
				"avatar_url": "https://grafana.com/assets/img/fav32.png",
				"url": "http://localhost",
				"message": "{{ template \"invalid.template\" }}"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"avatar_url": "https://grafana.com/assets/img/fav32.png",
				"content":    "",
				"embeds": []interface{}{map[string]interface{}{
					"color": 1.4037554e+07,
					"footer": map[string]interface{}{
						"icon_url": "https://grafana.com/assets/img/fav32.png",
						"text":     "Grafana v" + setting.BuildVersion,
					},
					"title": "[FIRING:1]  (val1)",
					"url":   "http://localhost/alerting/list",
					"type":  "rich",
				}},
				"username": "Grafana",
			},
			expMsgError: nil,
		},
		{
			name: "Invalid avatar URL template",
			settings: `{
				"avatar_url": "{{ invalid } }}",
				"url": "http://localhost",
				"message": "valid message"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"avatar_url": "{{ invalid } }}",
				"content":    "valid message",
				"embeds": []interface{}{map[string]interface{}{
					"color": 1.4037554e+07,
					"footer": map[string]interface{}{
						"icon_url": "https://grafana.com/assets/img/fav32.png",
						"text":     "Grafana v" + setting.BuildVersion,
					},
					"title": "[FIRING:1]  (val1)",
					"url":   "http://localhost/alerting/list",
					"type":  "rich",
				}},
				"username": "Grafana",
			},
			expMsgError: nil,
		},
		{
			name: "Invalid URL template",
			settings: `{
				"avatar_url": "https://grafana.com/assets/img/fav32.png",
				"url": "http://localhost?q={{invalid }}}",
				"message": "valid message"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"avatar_url": "https://grafana.com/assets/img/fav32.png",
				"content":    "valid message",
				"embeds": []interface{}{map[string]interface{}{
					"color": 1.4037554e+07,
					"footer": map[string]interface{}{
						"icon_url": "https://grafana.com/assets/img/fav32.png",
						"text":     "Grafana v" + setting.BuildVersion,
					},
					"title": "[FIRING:1]  (val1)",
					"url":   "http://localhost/alerting/list",
					"type":  "rich",
				}},
				"username": "Grafana",
			},
			expMsgError: nil,
		},
		{
			name: "Custom config with multiple alerts",
			settings: `{
				"avatar_url": "https://grafana.com/assets/img/fav32.png",
				"url": "http://localhost",
				"message": "{{ len .Alerts.Firing }} alerts are firing, {{ len .Alerts.Resolved }} are resolved"
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
			expMsg: map[string]interface{}{
				"avatar_url": "https://grafana.com/assets/img/fav32.png",
				"content":    "2 alerts are firing, 0 are resolved",
				"embeds": []interface{}{map[string]interface{}{
					"color": 1.4037554e+07,
					"footer": map[string]interface{}{
						"icon_url": "https://grafana.com/assets/img/fav32.png",
						"text":     "Grafana v" + setting.BuildVersion,
					},
					"title": "[FIRING:2]  ",
					"url":   "http://localhost/alerting/list",
					"type":  "rich",
				}},
				"username": "Grafana",
			},
			expMsgError: nil,
		},
		{
			name:         "Error in initialization",
			settings:     `{}`,
			expInitError: `could not find webhook url property in settings`,
		},
		{
			name: "Default config with one alert, use default discord username",
			settings: `{
				"url": "http://localhost",
				"use_discord_username": true
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"content": "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
				"embeds": []interface{}{map[string]interface{}{
					"color": 1.4037554e+07,
					"footer": map[string]interface{}{
						"icon_url": "https://grafana.com/assets/img/fav32.png",
						"text":     "Grafana v" + setting.BuildVersion,
					},
					"title": "[FIRING:1]  (val1)",
					"url":   "http://localhost/alerting/list",
					"type":  "rich",
				}},
			},
			expMsgError: nil,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJson, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "discord_testing",
				Type:     "discord",
				Settings: settingsJson,
			}

			webhookSender := mockNotificationService()
			cfg, err := NewDiscordConfig(m)
			if c.expInitError != "" {
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)
			imageStore := &UnavailableImageStore{}

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			dn := NewDiscordNotifier(cfg, webhookSender, imageStore, tmpl)
			ok, err := dn.Notify(ctx, c.alerts...)
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
