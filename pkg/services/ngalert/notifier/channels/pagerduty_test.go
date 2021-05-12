package channels

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"testing"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func TestPagerdutyNotifier(t *testing.T) {
	tmpl, err := template.FromGlobs("templates/default.tmpl")
	require.NoError(t, err)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	hostname, err := os.Hostname()
	require.NoError(t, err)

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expMsg       *pagerDutyMessage
		expInitError error
		expMsgError  error
	}{
		{
			name:     "Default config with one alert",
			settings: `{"integrationKey": "abcdefgh0123456789"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
			},
			expMsg: &pagerDutyMessage{
				RoutingKey:  "abcdefgh0123456789",
				DedupKey:    "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733",
				Description: "[firing:1]  (val1)",
				EventAction: "trigger",
				Payload: &pagerDutyPayload{
					Summary:   "[FIRING:1]  (val1)",
					Source:    hostname,
					Severity:  "critical",
					Class:     "default",
					Component: "Grafana",
					Group:     "default",
					CustomDetails: map[string]string{
						"firing":       "Labels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSource: \n",
						"num_firing":   "1",
						"num_resolved": "0",
						"resolved":     "",
					},
				},
				Client:    "Grafana",
				ClientURL: "http://localhost",
				Links:     []pagerDutyLink{{HRef: "http://localhost", Text: "External URL"}},
			},
			expInitError: nil,
			expMsgError:  nil,
		}, {
			name: "Custom config with multiple alerts",
			settings: `{
				"integrationKey": "abcdefgh0123456789",
				"severity": "warning",
				"class": "{{ .Status }}",
				"component": "My Grafana",
				"group": "my_group"
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
			expMsg: &pagerDutyMessage{
				RoutingKey:  "abcdefgh0123456789",
				DedupKey:    "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733",
				Description: "[firing:2]  ",
				EventAction: "trigger",
				Payload: &pagerDutyPayload{
					Summary:   "[FIRING:2]  ",
					Source:    hostname,
					Severity:  "warning",
					Class:     "firing",
					Component: "My Grafana",
					Group:     "my_group",
					CustomDetails: map[string]string{
						"firing":       "Labels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSource: \nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSource: \n",
						"num_firing":   "2",
						"num_resolved": "0",
						"resolved":     "",
					},
				},
				Client:    "Grafana",
				ClientURL: "http://localhost",
				Links:     []pagerDutyLink{{HRef: "http://localhost", Text: "External URL"}},
			},
			expInitError: nil,
			expMsgError:  nil,
		}, {
			name:         "Error in initing",
			settings:     `{}`,
			expInitError: alerting.ValidationError{Reason: "Could not find integration key property in settings"},
		}, {
			name: "Error in building message",
			settings: `{
				"integrationKey": "abcdefgh0123456789",
				"class": "{{ .Status }"
			}`,
			expMsgError: errors.New("build pagerduty message: failed to template PagerDuty message: template: :1: unexpected \"}\" in operand"),
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &models.AlertNotification{
				Name:     "pageduty_testing",
				Type:     "pagerduty",
				Settings: settingsJSON,
			}

			pn, err := NewPagerdutyNotifier(m, tmpl)
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
				require.False(t, ok)
				require.Error(t, err)
				require.Equal(t, c.expMsgError.Error(), err.Error())
				return
			}
			require.True(t, ok)
			require.NoError(t, err)

			expBody, err := json.Marshal(c.expMsg)
			require.NoError(t, err)

			require.JSONEq(t, string(expBody), body)
		})
	}
}
