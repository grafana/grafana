package channels

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/notifications"
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
		response     *mockResponse
		expMsg       map[string]interface{}
		expInitError string
		expMsgError  error
	}{{
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
			"attachments": []map[string]interface{}{{
				"content": map[string]interface{}{
					"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
					"body": []map[string]interface{}{{
						"color":  "attention",
						"size":   "large",
						"text":   "[FIRING:1]  (val1)",
						"type":   "TextBlock",
						"weight": "bolder",
						"wrap":   true,
					}, {
						"text": "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
						"type": "TextBlock",
						"wrap": true,
					}, {
						"actions": []map[string]interface{}{{
							"title": "View URL",
							"type":  "Action.OpenUrl",
							"url":   "http://localhost/alerting/list",
						}},
						"type": "ActionSet",
					}},
					"type":    "AdaptiveCard",
					"version": "1.4",
					"msTeams": map[string]interface{}{
						"width": "Full",
					},
				},
				"contentType": "application/vnd.microsoft.card.adaptive",
			}},
			"summary": "[FIRING:1]  (val1)",
			"type":    "message",
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
			"attachments": []map[string]interface{}{{
				"content": map[string]interface{}{
					"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
					"body": []map[string]interface{}{{
						"color":  "attention",
						"size":   "large",
						"text":   "alert1",
						"type":   "TextBlock",
						"weight": "bolder",
						"wrap":   true,
					}, {
						"text": "2 alerts are firing, 0 are resolved",
						"type": "TextBlock",
						"wrap": true,
					}, {
						"actions": []map[string]interface{}{{
							"title": "View URL",
							"type":  "Action.OpenUrl",
							"url":   "http://localhost/alerting/list",
						}},
						"type": "ActionSet",
					}},
					"type":    "AdaptiveCard",
					"version": "1.4",
					"msTeams": map[string]interface{}{
						"width": "Full",
					},
				},
				"contentType": "application/vnd.microsoft.card.adaptive",
			}},
			"summary": "alert1",
			"type":    "message",
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
			"attachments": []map[string]interface{}{{
				"content": map[string]interface{}{
					"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
					"body": []map[string]interface{}{{
						"color":  "attention",
						"size":   "large",
						"text":   "alert1",
						"type":   "TextBlock",
						"weight": "bolder",
						"wrap":   true,
					}, {
						"text": "I'm a custom template ",
						"type": "TextBlock",
						"wrap": true,
					}, {
						"actions": []map[string]interface{}{{
							"title": "View URL",
							"type":  "Action.OpenUrl",
							"url":   "http://localhost/alerting/list",
						}},
						"type": "ActionSet",
					}},
					"type":    "AdaptiveCard",
					"version": "1.4",
					"msTeams": map[string]interface{}{
						"width": "Full",
					},
				},
				"contentType": "application/vnd.microsoft.card.adaptive",
			}},
			"type": "message",
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
			"attachments": []map[string]interface{}{{
				"content": map[string]interface{}{
					"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
					"body": []map[string]interface{}{{
						"color":  "attention",
						"size":   "large",
						"text":   "alert1",
						"type":   "TextBlock",
						"weight": "bolder",
						"wrap":   true,
					}, {
						"text": "",
						"type": "TextBlock",
						"wrap": true,
					}, {
						"actions": []map[string]interface{}{{
							"title": "View URL",
							"type":  "Action.OpenUrl",
							"url":   "http://localhost/alerting/list",
						}},
						"type": "ActionSet",
					}},
					"type":    "AdaptiveCard",
					"version": "1.4",
					"msTeams": map[string]interface{}{
						"width": "Full",
					},
				},
				"contentType": "application/vnd.microsoft.card.adaptive",
			}},
			"type": "message",
		},
		expMsgError: nil,
	}, {
		name:         "Error in initing",
		settings:     `{}`,
		expInitError: `could not find url property in settings`,
	}, {
		name:     "webhook returns error message in body with 200",
		settings: `{"url": "http://localhost"}`,
		alerts: []*types.Alert{
			{
				Alert: model.Alert{
					Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
					Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
				},
			},
		},
		response: &mockResponse{
			status: 200,
			body:   "some error message",
			error:  nil,
		},
		expMsgError: errors.New("send notification to Teams: webhook failed validation: some error message"),
	}}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "teams_testing",
				Type:     "teams",
				Settings: settingsJSON,
			}

			webhookSender := CreateNotificationService(t)

			originalClient := notifications.NetClient
			defer func() {
				notifications.SetWebhookClient(*originalClient)
			}()
			clientStub := newMockClient(c.response)
			notifications.SetWebhookClient(clientStub)

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

			require.NotEmpty(t, clientStub.lastRequest.URL.String())

			expBody, err := json.Marshal(c.expMsg)
			require.NoError(t, err)

			body, err := io.ReadAll(clientStub.lastRequest.Body)
			require.NoError(t, err)
			require.JSONEq(t, string(expBody), string(body))
		})
	}
}

type mockClient struct {
	response    mockResponse
	lastRequest *http.Request
}

type mockResponse struct {
	status int
	body   string
	error  error
}

func (c *mockClient) Do(req *http.Request) (*http.Response, error) {
	// Do Nothing
	c.lastRequest = req
	return makeResponse(c.response.status, c.response.body), c.response.error
}

func newMockClient(resp *mockResponse) *mockClient {
	client := &mockClient{}

	if resp != nil {
		client.response = *resp
	} else {
		client.response = mockResponse{
			status: 200,
			body:   "1",
			error:  nil,
		}
	}

	return client
}

func makeResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}
