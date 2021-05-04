package channels

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func TestSlackNotifier(t *testing.T) {
	tmpl, err := template.FromGlobs("templates/default.tmpl")
	require.NoError(t, err)

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
						TitleLink:  "TODO: rule URL",
						Text:       "",
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
						TitleLink:  "TODO: rule URL",
						Text:       "",
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
						TitleLink:  "TODO: rule URL",
						Text:       "",
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
		}, {
			name: "Error in building message",
			settings: `{
				"url": "https://test.slack.com",
				"title": "{{ .BrokenTemplate }"
			}`,
			expMsgError: errors.New("build slack message: failed to template Slack message: template: :1: unexpected \"}\" in operand"),
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &models.AlertNotification{
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

			require.Equal(t, string(expBody), body)
		})
	}
}
