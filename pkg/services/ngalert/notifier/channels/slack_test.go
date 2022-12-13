package channels

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSlackIncomingWebhook(t *testing.T) {
	tests := []struct {
		name            string
		alerts          []*types.Alert
		expectedMessage *slackMessage
		expectedError   string
		settings        string
	}{{
		name: "Message is sent",
		settings: `{
			"icon_emoji": ":emoji:",
			"recipient": "#test",
			"url": "https://example.com/hooks/xxxx"
		}`,
		alerts: []*types.Alert{{
			Alert: model.Alert{
				Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
				Annotations: model.LabelSet{"ann1": "annv1"},
			},
		}},
		expectedMessage: &slackMessage{
			Channel:   "#test",
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
					FooterIcon: "https://grafana.com/static/assets/img/fav32.png",
					Color:      "#D63232",
				},
			},
		},
	}, {
		name: "Message is sent with image URL",
		settings: `{
				"icon_emoji": ":emoji:",
				"recipient": "#test",
				"url": "https://example.com/hooks/xxxx"
			}`,
		alerts: []*types.Alert{{
			Alert: model.Alert{
				Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
				Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh", "__alertImageToken__": "image-with-url"},
			},
		}},
		expectedMessage: &slackMessage{
			Channel:   "#test",
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
					FooterIcon: "https://grafana.com/static/assets/img/fav32.png",
					Color:      "#D63232",
					ImageURL:   "https://www.example.com/test.png",
				},
			},
		},
	}, {
		name: "Message is sent and image on local disk is ignored",
		settings: `{
				"icon_emoji": ":emoji:",
				"recipient": "#test",
				"url": "https://example.com/hooks/xxxx"
			}`,
		alerts: []*types.Alert{{
			Alert: model.Alert{
				Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
				Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh", "__alertImageToken__": "image-on-disk"},
			},
		}},
		expectedMessage: &slackMessage{
			Channel:   "#test",
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
					FooterIcon: "https://grafana.com/static/assets/img/fav32.png",
					Color:      "#D63232",
				},
			},
		},
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			notifier, recorder, err := setupSlackForTests(t, test.settings)
			require.NoError(t, err)

			ctx := context.Background()
			ctx = notify.WithGroupKey(ctx, "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})

			ok, err := notifier.Notify(ctx, test.alerts...)
			if test.expectedError != "" {
				assert.EqualError(t, err, test.expectedError)
				assert.False(t, ok)
			} else {
				assert.NoError(t, err)
				assert.True(t, ok)

				// When sending a notification to an Incoming Webhook there should a single request.
				// This is different from PostMessage where some content, such as images, are sent
				// as replies to the original message
				require.Len(t, recorder.requests, 1)

				// Get the request and check that it's sending to the URL of the Incoming Webhook
				r := recorder.requests[0]
				assert.Equal(t, notifier.settings.URL, r.URL.String())

				// Check that the request contains the expected message
				b, err := io.ReadAll(r.Body)
				require.NoError(t, err)

				message := slackMessage{}
				require.NoError(t, json.Unmarshal(b, &message))
				for i, v := range message.Attachments {
					// Need to update the ts as these cannot be set in the test definition
					test.expectedMessage.Attachments[i].Ts = v.Ts
				}
				assert.Equal(t, *test.expectedMessage, message)
			}
		})
	}
}

func TestSlackPostMessage(t *testing.T) {
	tests := []struct {
		name            string
		alerts          []*types.Alert
		expectedMessage *slackMessage
		expectedReplies []interface{} // can contain either slackMessage or map[string]struct{} for multipart/form-data
		expectedError   string
		settings        string
	}{{
		name: "Message is sent",
		settings: `{
			"icon_emoji": ":emoji:",
			"recipient": "#test",
			"token": "1234"
		}`,
		alerts: []*types.Alert{{
			Alert: model.Alert{
				Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
				Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
			},
		}},
		expectedMessage: &slackMessage{
			Channel:   "#test",
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
					FooterIcon: "https://grafana.com/static/assets/img/fav32.png",
					Color:      "#D63232",
				},
			},
		},
	}, {
		name: "Message is sent with two firing alerts",
		settings: `{
			"title": "{{ .Alerts.Firing | len }} firing, {{ .Alerts.Resolved | len }} resolved",
			"icon_emoji": ":emoji:",
			"recipient": "#test",
			"token": "1234"
		}`,
		alerts: []*types.Alert{{
			Alert: model.Alert{
				Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
				Annotations: model.LabelSet{"ann1": "annv1"},
			},
		}, {
			Alert: model.Alert{
				Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
				Annotations: model.LabelSet{"ann1": "annv2"},
			},
		}},
		expectedMessage: &slackMessage{
			Channel:   "#test",
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
					FooterIcon: "https://grafana.com/static/assets/img/fav32.png",
					Color:      "#D63232",
				},
			},
		},
	}, {
		name: "Message is sent and image is uploaded",
		settings: `{
			"icon_emoji": ":emoji:",
			"recipient": "#test",
			"token": "1234"
		}`,
		alerts: []*types.Alert{{
			Alert: model.Alert{
				Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
				Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh", "__alertImageToken__": "image-on-disk"},
			},
		}},
		expectedMessage: &slackMessage{
			Channel:   "#test",
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
					FooterIcon: "https://grafana.com/static/assets/img/fav32.png",
					Color:      "#D63232",
				},
			},
		},
		expectedReplies: []interface{}{
			// check that the following parts are present in the multipart/form-data
			map[string]struct{}{
				"file":            {},
				"channels":        {},
				"initial_comment": {},
				"thread_ts":       {},
			},
		},
	}, {
		name: "Message is sent to custom URL",
		settings: `{
			"icon_emoji": ":emoji:",
			"recipient": "#test",
			"endpointUrl": "https://example.com/api",
			"token": "1234"
		}`,
		alerts: []*types.Alert{{
			Alert: model.Alert{
				Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
				Annotations: model.LabelSet{"ann1": "annv1"},
			},
		}},
		expectedMessage: &slackMessage{
			Channel:   "#test",
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
					FooterIcon: "https://grafana.com/static/assets/img/fav32.png",
					Color:      "#D63232",
				},
			},
		},
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			notifier, recorder, err := setupSlackForTests(t, test.settings)
			require.NoError(t, err)

			ctx := context.Background()
			ctx = notify.WithGroupKey(ctx, "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})

			ok, err := notifier.Notify(ctx, test.alerts...)
			if test.expectedError != "" {
				assert.EqualError(t, err, test.expectedError)
				assert.False(t, ok)
			} else {
				assert.NoError(t, err)
				assert.True(t, ok)

				// When sending a notification via PostMessage some content, such as images,
				// are sent as replies to the original message
				require.Len(t, recorder.requests, len(test.expectedReplies)+1)

				// Get the request and check that it's sending to the URL
				r := recorder.requests[0]
				assert.Equal(t, notifier.settings.URL, r.URL.String())

				// Check that the request contains the expected message
				b, err := io.ReadAll(r.Body)
				require.NoError(t, err)

				message := slackMessage{}
				require.NoError(t, json.Unmarshal(b, &message))
				for i, v := range message.Attachments {
					// Need to update the ts as these cannot be set in the test definition
					test.expectedMessage.Attachments[i].Ts = v.Ts
				}
				assert.Equal(t, *test.expectedMessage, message)

				// Check that the replies match expectations
				for i := 1; i < len(recorder.requests); i++ {
					r = recorder.requests[i]
					assert.Equal(t, "https://slack.com/api/files.upload", r.URL.String())

					media, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
					require.NoError(t, err)
					if media == "multipart/form-data" {
						// Some replies are file uploads, so check the multipart form
						checkMultipart(t, test.expectedReplies[i-1].(map[string]struct{}), r.Body, params["boundary"])
					} else {
						b, err = io.ReadAll(r.Body)
						require.NoError(t, err)
						message = slackMessage{}
						require.NoError(t, json.Unmarshal(b, &message))
						assert.Equal(t, test.expectedReplies[i-1], message)
					}
				}
			}
		})
	}
}

// slackRequestRecorder is used in tests to record all requests.
type slackRequestRecorder struct {
	requests []*http.Request
}

func (s *slackRequestRecorder) fn(_ context.Context, r *http.Request, _ log.Logger) (string, error) {
	s.requests = append(s.requests, r)
	return "", nil
}

// checkMulipart checks that each part is present, but not its contents
func checkMultipart(t *testing.T, expected map[string]struct{}, r io.Reader, boundary string) {
	m := multipart.NewReader(r, boundary)
	visited := make(map[string]struct{})
	for {
		part, err := m.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)
		visited[part.FormName()] = struct{}{}
	}
	assert.Equal(t, expected, visited)
}

func setupSlackForTests(t *testing.T, settings string) (*SlackNotifier, *slackRequestRecorder, error) {
	tmpl := templateForTests(t)
	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	f, err := os.Create(t.TempDir() + "test.png")
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = f.Close()
		if err := os.Remove(f.Name()); err != nil {
			t.Logf("failed to delete test file: %s", err)
		}
	})

	images := &fakeImageStore{
		Images: []*models.Image{{
			Token: "image-on-disk",
			Path:  f.Name(),
		}, {
			Token: "image-with-url",
			URL:   "https://www.example.com/test.png",
		}},
	}

	settingsJSON, err := simplejson.NewJson([]byte(settings))
	require.NoError(t, err)

	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	notificationService := mockNotificationService()

	c := FactoryConfig{
		Config: &NotificationChannelConfig{
			Name:           "slack_testing",
			Type:           "slack",
			Settings:       settingsJSON,
			SecureSettings: make(map[string][]byte),
		},
		ImageStore:          images,
		NotificationService: notificationService,
		DecryptFunc:         secretsService.GetDecryptedValue,
		Template:            tmpl,
	}

	sn, err := buildSlackNotifier(c)
	if err != nil {
		return nil, nil, err
	}

	sr := &slackRequestRecorder{}
	sn.sendFn = sr.fn
	return sn, sr, nil
}

func TestCreateSlackNotifierFromConfig(t *testing.T) {
	tests := []struct {
		name          string
		settings      string
		expectedError string
	}{{
		name: "Missing token",
		settings: `{
			"recipient": "#testchannel"
		}`,
		expectedError: "token must be specified when using the Slack chat API",
	}, {
		name: "Missing recipient",
		settings: `{
			"token": "1234"
		}`,
		expectedError: "recipient must be specified when using the Slack chat API",
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			n, _, err := setupSlackForTests(t, test.settings)
			if test.expectedError != "" {
				assert.Nil(t, n)
				assert.EqualError(t, err, test.expectedError)
			} else {
				assert.NotNil(t, n)
				assert.Nil(t, err)
			}
		})
	}
}

func TestSendSlackRequest(t *testing.T) {
	tests := []struct {
		name        string
		response    string
		statusCode  int
		expectError bool
	}{
		{
			name: "Example error",
			response: `{
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
			response: `{
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
			name:        "No response body",
			statusCode:  http.StatusOK,
			expectError: true,
		},
		{
			name:        "Success case, unexpected response body",
			statusCode:  http.StatusOK,
			response:    `{"test": true}`,
			expectError: true,
		},
		{
			name:        "Success case, ok: true",
			statusCode:  http.StatusOK,
			response:    `{"ok": true}`,
			expectError: false,
		},
		{
			name:        "200 status code, error in body",
			statusCode:  http.StatusOK,
			response:    `{"ok": false, "error": "test error"}`,
			expectError: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(test.statusCode)
				_, err := w.Write([]byte(test.response))
				require.NoError(tt, err)
			}))
			defer server.Close()
			req, err := http.NewRequest(http.MethodGet, server.URL, nil)
			require.NoError(tt, err)

			_, err = sendSlackRequest(context.Background(), req, log.New("test"))
			if !test.expectError {
				require.NoError(tt, err)
			} else {
				require.Error(tt, err)
			}
		})
	}
}
