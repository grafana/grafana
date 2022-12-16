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

func TestDingdingNotifier(t *testing.T) {
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
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh", "__values__": "{\"A\": 1234}", "__value_string__": "1234"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"msgtype": "link",
				"link": map[string]interface{}{
					"messageUrl": "dingtalk://dingtalkclient/page/link?pc_slide=false&url=http%3A%2F%2Flocalhost%2Falerting%2Flist",
					"text":       "**Firing**\n\nValue: A=1234\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
					"title":      "[FIRING:1]  (val1)",
				},
			},
			expMsgError: nil,
		}, {
			name: "Custom config with multiple alerts",
			settings: `{
				"url": "http://localhost",
				"message": "{{ len .Alerts.Firing }} alerts are firing, {{ len .Alerts.Resolved }} are resolved",
				"msgType": "actionCard"
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
				"actionCard": map[string]interface{}{
					"singleTitle": "More",
					"singleURL":   "dingtalk://dingtalkclient/page/link?pc_slide=false&url=http%3A%2F%2Flocalhost%2Falerting%2Flist",
					"text":        "2 alerts are firing, 0 are resolved",
					"title":       "[FIRING:2]  ",
				},
				"msgtype": "actionCard",
			},
			expMsgError: nil,
		}, {
			name:     "Default config with one alert and custom title and description",
			settings: `{"url": "http://localhost", "title": "Alerts firing: {{ len .Alerts.Firing }}", "message": "customMessage"}}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh", "__values__": "{\"A\": 1234}", "__value_string__": "1234"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"msgtype": "link",
				"link": map[string]interface{}{
					"messageUrl": "dingtalk://dingtalkclient/page/link?pc_slide=false&url=http%3A%2F%2Flocalhost%2Falerting%2Flist",
					"text":       "customMessage",
					"title":      "Alerts firing: 1",
				},
			},
			expMsgError: nil,
		}, {
			name: "Missing field in template",
			settings: `{
				"url": "http://localhost",
				"message": "I'm a custom template {{ .NotAField }} bad template",
				"msgType": "actionCard"
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
				"link": map[string]interface{}{
					"messageUrl": "dingtalk://dingtalkclient/page/link?pc_slide=false&url=http%3A%2F%2Flocalhost%2Falerting%2Flist",
					"text":       "I'm a custom template ",
					"title":      "",
				},
				"msgtype": "link",
			},
			expMsgError: nil,
		}, {
			name: "Invalid template",
			settings: `{
				"url": "http://localhost",
				"message": "I'm a custom template {{ {.NotAField }} bad template",
				"msgType": "actionCard"
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
				"link": map[string]interface{}{
					"messageUrl": "dingtalk://dingtalkclient/page/link?pc_slide=false&url=http%3A%2F%2Flocalhost%2Falerting%2Flist",
					"text":       "",
					"title":      "",
				},
				"msgtype": "link",
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

			webhookSender := mockNotificationService()
			fc := FactoryConfig{
				Config: &NotificationChannelConfig{
					Name:     "dingding_testing",
					Type:     "dingding",
					Settings: settingsJSON,
				},
				// TODO: allow changing the associated values for different tests.
				NotificationService: webhookSender,
				Template:            tmpl,
				Logger:              &FakeLogger{},
			}
			pn, err := newDingDingNotifier(fc)
			if c.expInitError != "" {
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

			require.NotEmpty(t, webhookSender.Webhook.Url)

			expBody, err := json.Marshal(c.expMsg)
			require.NoError(t, err)

			require.JSONEq(t, string(expBody), webhookSender.Webhook.Body)
		})
	}
}
