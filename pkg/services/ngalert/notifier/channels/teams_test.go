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
)

func TestTeamsNotifier(t *testing.T) {
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
				"@type":      "MessageCard",
				"@context":   "http://schema.org/extensions",
				"summary":    "[FIRING:1]  (val1)",
				"title":      "[FIRING:1]  (val1)",
				"themeColor": "#D63232",
				"sections": []map[string]interface{}{
					{
						"title": "",
						"text":  "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
					},
				},
				"potentialAction": []map[string]interface{}{
					{
						"@context": "http://schema.org",
						"@type":    "OpenUri",
						"name":     "View Rule",
						"targets":  []map[string]interface{}{{"os": "default", "uri": "http://localhost/alerting/list"}},
					},
				},
			},
			expMsgError: nil,
		}, {
			name: "Custom config with multiple alerts",
			settings: `{
				"url": "http://localhost",
				"title": "{{ .CommonLabels.alertname }}",
				"sectiontitle": "Details",
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
				"@type":      "MessageCard",
				"@context":   "http://schema.org/extensions",
				"summary":    "alert1",
				"title":      "alert1",
				"themeColor": "#D63232",
				"sections": []map[string]interface{}{
					{
						"title": "Details",
						"text":  "2 alerts are firing, 0 are resolved",
					},
				},
				"potentialAction": []map[string]interface{}{
					{
						"@context": "http://schema.org",
						"@type":    "OpenUri",
						"name":     "View Rule",
						"targets":  []map[string]interface{}{{"os": "default", "uri": "http://localhost/alerting/list"}},
					},
				},
			},
			expMsgError: nil,
		}, {
			name: "Missing field in template",
			settings: `{
				"url": "http://localhost",
				"title": "{{ .CommonLabels.alertname }}",
				"sectiontitle": "Details",
				"message": "I'm a custom template {{ .NotAField }} bad template"
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
				"@type":      "MessageCard",
				"@context":   "http://schema.org/extensions",
				"summary":    "alert1",
				"title":      "alert1",
				"themeColor": "#D63232",
				"sections": []map[string]interface{}{
					{
						"title": "Details",
						"text":  "I'm a custom template ",
					},
				},
				"potentialAction": []map[string]interface{}{
					{
						"@context": "http://schema.org",
						"@type":    "OpenUri",
						"name":     "View Rule",
						"targets":  []map[string]interface{}{{"os": "default", "uri": "http://localhost/alerting/list"}},
					},
				},
			},
			expMsgError: nil,
		}, {
			name: "Invalid template",
			settings: `{
				"url": "http://localhost",
				"title": "{{ .CommonLabels.alertname }}",
				"sectiontitle": "Details",
				"message": "I'm a custom template {{ {.NotAField }} bad template"
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
				"@type":      "MessageCard",
				"@context":   "http://schema.org/extensions",
				"summary":    "alert1",
				"title":      "alert1",
				"themeColor": "#D63232",
				"sections": []map[string]interface{}{
					{
						"title": "Details",
						"text":  "",
					},
				},
				"potentialAction": []map[string]interface{}{
					{
						"@context": "http://schema.org",
						"@type":    "OpenUri",
						"name":     "View Rule",
						"targets":  []map[string]interface{}{{"os": "default", "uri": "http://localhost/alerting/list"}},
					},
				},
			},
			expMsgError: nil,
		}, {
			name:         "Error in initing",
			settings:     `{}`,
			expInitError: `could not find url property in settings`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "teams_testing",
				Type:     "teams",
				Settings: settingsJSON,
			}

			webhookSender := mockNotificationService()
			cfg, err := NewTeamsConfig(m)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			pn := NewTeamsNotifier(cfg, webhookSender, &UnavailableImageStore{}, tmpl)
			ok, err := pn.Notify(ctx, c.alerts...)
			if c.expMsgError != nil {
				require.False(t, ok)
				require.Error(t, err)
				require.Equal(t, c.expMsgError.Error(), err.Error())
				return
			}
			require.True(t, ok)
			require.NoError(t, err)

			require.NotEmpty(t, webhookSender.Webhook.Url)

			expBody, err := json.Marshal(c.expMsg)
			require.NoError(t, err)

			require.JSONEq(t, string(expBody), webhookSender.Webhook.Body)
		})
	}
}
