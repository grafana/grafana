package channels

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/url"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPushoverNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expMsg       map[string]string
		expInitError error
		expMsgError  error
	}{
		{
			name: "Correct config with one alert",
			settings: `{
				"userKey": "<userKey>",
				"apiToken": "<apiToken>"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"__alert_rule_uid__": "rule uid", "alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: map[string]string{
				"user":      "<userKey>",
				"token":     "<apiToken>",
				"priority":  "0",
				"sound":     "",
				"title":     "[FIRING:1]  (val1)",
				"url":       "http://localhost/alerting/list",
				"url_title": "Show alert rule",
				"message":   "**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
				"html":      "1",
			},
			expInitError: nil,
			expMsgError:  nil,
		},
		{
			name: "Custom config with multiple alerts",
			settings: `{
					"userKey": "<userKey>",
					"apiToken": "<apiToken>",
					"device": "device",
					"priority": "2",
					"okpriority": "0",
					"retry": "30",
					"expire": "86400",
					"sound": "echo",
					"oksound": "magic",
					"message": "{{ len .Alerts.Firing }} alerts are firing, {{ len .Alerts.Resolved }} are resolved"
				}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"__alert_rule_uid__": "rule uid", "alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2"},
					},
				},
			},
			expMsg: map[string]string{
				"user":      "<userKey>",
				"token":     "<apiToken>",
				"priority":  "2",
				"sound":     "echo",
				"title":     "[FIRING:2]  ",
				"url":       "http://localhost/alerting/list",
				"url_title": "Show alert rule",
				"message":   "2 alerts are firing, 0 are resolved",
				"html":      "1",
				"retry":     "30",
				"expire":    "86400",
				"device":    "device",
			},
			expInitError: nil,
			expMsgError:  nil,
		},
		{
			name: "Missing user key",
			settings: `{
				"apiToken": "<apiToken>"
			}`,
			expInitError: alerting.ValidationError{Reason: "user key not found"},
		}, {
			name: "Missing api key",
			settings: `{
				"userKey": "<userKey>"
			}`,
			expInitError: alerting.ValidationError{Reason: "API token not found"},
		},
	}

	for _, c := range cases {
		origGetBoundary := GetBoundary
		boundary := "abcd"
		GetBoundary = func() string {
			return boundary
		}
		t.Cleanup(func() {
			GetBoundary = origGetBoundary
		})

		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "pushover_testing",
				Type:     "pushover",
				Settings: settingsJSON,
			}

			pn, err := NewPushoverNotifier(m, tmpl)
			if c.expInitError != nil {
				require.Error(t, err)
				require.Equal(t, c.expInitError.Error(), err.Error())
				return
			}
			require.NoError(t, err)

			body := ""
			bus.AddHandlerCtx("test", func(ctx context.Context, webhook *models.SendWebhookSync) error {
				body = webhook.Body
				return nil
			})

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			ok, err := pn.Notify(ctx, c.alerts...)
			if c.expMsgError != nil {
				require.Error(t, err)
				require.False(t, ok)
				require.Equal(t, c.expMsgError.Error(), err.Error())
				return
			}
			require.NoError(t, err)
			require.True(t, ok)

			bodyReader := multipart.NewReader(strings.NewReader(body), boundary)
			for {
				part, err := bodyReader.NextPart()
				if part == nil || errors.Is(err, io.EOF) {
					assert.Empty(t, c.expMsg, fmt.Sprintf("expected fields %v", c.expMsg))
					break
				}
				formField := part.FormName()
				expected, ok := c.expMsg[formField]
				assert.True(t, ok, fmt.Sprintf("unexpected field %s", formField))
				actual := []byte("")
				if expected != "" {
					buf := new(bytes.Buffer)
					_, err := buf.ReadFrom(part)
					require.NoError(t, err)
					actual = buf.Bytes()
				}
				assert.Equal(t, expected, string(actual))
				delete(c.expMsg, formField)
			}
		})
	}
}
