package channels

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
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
		expInitError string
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
						Text:       "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
						Fallback:   "[FIRING:1]  (val1)",
						Fields:     nil,
						Footer:     "Grafana v" + setting.BuildVersion,
						FooterIcon: "https://grafana.com/assets/img/fav32.png",
						Color:      "#D63232",
						Ts:         0,
					},
				},
			},
			expMsgError: nil,
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
						Text:       "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\n",
						Fallback:   "[FIRING:1]  (val1)",
						Fields:     nil,
						Footer:     "Grafana v" + setting.BuildVersion,
						FooterIcon: "https://grafana.com/assets/img/fav32.png",
						Color:      "#D63232",
						Ts:         0,
					},
				},
			},
			expMsgError: nil,
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
						Text:       "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2\n",
						Fallback:   "2 firing, 0 resolved",
						Fields:     nil,
						Footer:     "Grafana v" + setting.BuildVersion,
						FooterIcon: "https://grafana.com/assets/img/fav32.png",
						Color:      "#D63232",
						Ts:         0,
					},
				},
			},
			expMsgError: nil,
		}, {
			name: "Missing token",
			settings: `{
				"recipient": "#testchannel"
			}`,
			expInitError: `token must be specified when using the Slack chat API`,
		}, {
			name: "Missing recipient",
			settings: `{
				"token": "1234"
			}`,
			expInitError: `recipient must be specified when using the Slack chat API`,
		},
		{
			name: "Custom endpoint url",
			settings: `{
				"token": "1234",
				"recipient": "#testchannel",
				"endpointUrl": "https://slack-custom.com/api/",
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
						Text:       "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\n",
						Fallback:   "[FIRING:1]  (val1)",
						Fields:     nil,
						Footer:     "Grafana v" + setting.BuildVersion,
						FooterIcon: "https://grafana.com/assets/img/fav32.png",
						Color:      "#D63232",
						Ts:         0,
					},
				},
			},
			expMsgError: nil,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)
			secureSettings := make(map[string][]byte)

			secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
			decryptFn := secretsService.GetDecryptedValue
			fc := FactoryConfig{
				Config: &NotificationChannelConfig{
					Name:           "slack_testing",
					Type:           "slack",
					Settings:       settingsJSON,
					SecureSettings: secureSettings,
				},
				ImageStore:          &UnavailableImageStore{},
				NotificationService: mockNotificationService(),
				DecryptFunc:         decryptFn,
			}

			cfg, err := NewSlackConfig(fc)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
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

				url := settingsJSON.Get("url").MustString()
				if len(url) == 0 {
					endpointUrl := settingsJSON.Get("endpointUrl").MustString(SlackAPIEndpoint)
					require.Equal(t, endpointUrl, request.URL.String())
				}

				b, err := io.ReadAll(request.Body)
				require.NoError(t, err)
				body = string(b)
				return nil
			}

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			pn := NewSlackNotifier(cfg, fc.ImageStore, fc.NotificationService, tmpl)
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

func TestSendSlackRequest(t *testing.T) {
	tests := []struct {
		name          string
		slackResponse string
		statusCode    int
		expectError   bool
	}{
		{
			name: "Example error",
			slackResponse: `{
					"ok": false,
					"error": "too_many_attachments"
				}`,
			statusCode:  http.StatusBadRequest,
			expectError: true,
		},
		{
			name:        "Non 200 status code, no response body",
			statusCode:  http.StatusMovedPermanently,
			expectError: true,
		},
		{
			name: "Success case, normal response body",
			slackResponse: `{
				"ok": true,
				"channel": "C1H9RESGL",
				"ts": "1503435956.000247",
				"message": {
					"text": "Here's a message for you",
					"username": "ecto1",
					"bot_id": "B19LU7CSY",
					"attachments": [
						{
							"text": "This is an attachment",
							"id": 1,
							"fallback": "This is an attachment's fallback"
						}
					],
					"type": "message",
					"subtype": "bot_message",
					"ts": "1503435956.000247"
				}
			}`,
			statusCode:  http.StatusOK,
			expectError: false,
		},
		{
			name:       "No response body",
			statusCode: http.StatusOK,
		},
		{
			name:          "Success case, unexpected response body",
			statusCode:    http.StatusOK,
			slackResponse: `{"test": true}`,
			expectError:   false,
		},
		{
			name:          "Success case, ok: true",
			statusCode:    http.StatusOK,
			slackResponse: `{"ok": true}`,
			expectError:   false,
		},
		{
			name:          "200 status code, error in body",
			statusCode:    http.StatusOK,
			slackResponse: `{"ok": false, "error": "test error"}`,
			expectError:   true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(test.statusCode)
				_, err := w.Write([]byte(test.slackResponse))
				require.NoError(tt, err)
			}))
			defer server.Close()
			req, err := http.NewRequest(http.MethodGet, server.URL, nil)
			require.NoError(tt, err)

			err = sendSlackRequest(req, log.New("test"))
			if !test.expectError {
				require.NoError(tt, err)
			} else {
				require.Error(tt, err)
			}
		})
	}
}
