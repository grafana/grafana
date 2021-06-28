package channels

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func TestSlackNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expMsg       *slackMessage
		expInitError error
		expMsgError  error
	}{
		{
			name: "Correct config with one alert",
			settings: `{
				"token": "1234",
				"recipient": "#testchannel",
				"icon_emoji": ":emoji:"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: &slackMessage{
				Channel:   "#testchannel",
				Username:  "Grafana",
				IconEmoji: ":emoji:",
				Attachments: []attachment{
					{
						Title:      "[FIRING:1]  (val1)",
						TitleLink:  "http://localhost/alerting/list",
						Text:       "**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
						Fallback:   "[FIRING:1]  (val1)",
						Fields:     nil,
						Footer:     "Grafana v",
						FooterIcon: "https://grafana.com/assets/img/fav32.png",
						Color:      "#D63232",
						Ts:         0,
					},
				},
			},
			expInitError: nil,
			expMsgError:  nil,
		},
		{
			name: "Correct config with webhook",
			settings: `{
				"url": "https://webhook.com",
				"recipient": "#testchannel",
				"icon_emoji": ":emoji:"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
			},
			expMsg: &slackMessage{
				Channel:   "#testchannel",
				Username:  "Grafana",
				IconEmoji: ":emoji:",
				Attachments: []attachment{
					{
						Title:      "[FIRING:1]  (val1)",
						TitleLink:  "http://localhost/alerting/list",
						Text:       "**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\n",
						Fallback:   "[FIRING:1]  (val1)",
						Fields:     nil,
						Footer:     "Grafana v",
						FooterIcon: "https://grafana.com/assets/img/fav32.png",
						Color:      "#D63232",
						Ts:         0,
					},
				},
			},
			expInitError: nil,
			expMsgError:  nil,
		},
		{
			name: "Correct config with multiple alerts and template",
			settings: `{
				"token": "1234",
				"recipient": "#testchannel",
				"icon_emoji": ":emoji:",
				"title": "{{ .Alerts.Firing | len }} firing, {{ .Alerts.Resolved | len }} resolved"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2"},
					},
				},
			},
			expMsg: &slackMessage{
				Channel:   "#testchannel",
				Username:  "Grafana",
				IconEmoji: ":emoji:",
				Attachments: []attachment{
					{
						Title:      "2 firing, 0 resolved",
						TitleLink:  "http://localhost/alerting/list",
						Text:       "**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\n\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval2\n",
						Fallback:   "2 firing, 0 resolved",
						Fields:     nil,
						Footer:     "Grafana v",
						FooterIcon: "https://grafana.com/assets/img/fav32.png",
						Color:      "#D63232",
						Ts:         0,
					},
				},
			},
			expInitError: nil,
			expMsgError:  nil,
		}, {
			name: "Missing token",
			settings: `{
				"recipient": "#testchannel"
			}`,
			expInitError: alerting.ValidationError{Reason: "token must be specified when using the Slack chat API"},
		}, {
			name: "Missing recipient",
			settings: `{
				"token": "1234"
			}`,
			expInitError: alerting.ValidationError{Reason: "recipient must be specified when using the Slack chat API"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "slack_testing",
				Type:     "slack",
				Settings: settingsJSON,
			}

			pn, err := NewSlackNotifier(m, tmpl)
			if c.expInitError != nil {
				require.Error(t, err)
				require.Equal(t, c.expInitError.Error(), err.Error())
				return
			}
			require.NoError(t, err)

			body := ""
			origSendSlackRequest := sendSlackRequest
			t.Cleanup(func() {
				sendSlackRequest = origSendSlackRequest
			})
			sendSlackRequest = func(request *http.Request, log log.Logger) error {
				t.Helper()
				defer func() {
					_ = request.Body.Close()
				}()

				b, err := io.ReadAll(request.Body)
				require.NoError(t, err)
				body = string(b)
				return nil
			}

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			ok, err := pn.Notify(ctx, c.alerts...)
			if c.expMsgError != nil {
				require.Error(t, err)
				require.False(t, ok)
				require.Equal(t, c.expMsgError.Error(), err.Error())
				return
			}
			require.True(t, ok)
			require.NoError(t, err)

			// Getting Ts from actual since that can't be predicted.
			var obj slackMessage
			require.NoError(t, json.Unmarshal([]byte(body), &obj))
			c.expMsg.Attachments[0].Ts = obj.Attachments[0].Ts

			expBody, err := json.Marshal(c.expMsg)
			require.NoError(t, err)

			require.JSONEq(t, string(expBody), body)
		})
	}
}
