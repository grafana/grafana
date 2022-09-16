package channels

import (
	"context"
	"encoding/json"
	"net/url"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestPagerdutyNotifier(t *testing.T) {
	tmpl := templateForTests(t)

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
		expInitError string
		expMsgError  error
	}{
		{
			name:     "Default config with one alert",
			settings: `{"integrationKey": "abcdefgh0123456789"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: &pagerDutyMessage{
				RoutingKey:  "abcdefgh0123456789",
				DedupKey:    "6e3538104c14b583da237e9693b76debbc17f0f8058ef20492e5853096cf8733",
				Description: "[FIRING:1]  (val1)",
				EventAction: "trigger",
				Payload: pagerDutyPayload{
					Summary:   "[FIRING:1]  (val1)",
					Source:    hostname,
					Severity:  "critical",
					Class:     "default",
					Component: "Grafana",
					Group:     "default",
					CustomDetails: map[string]string{
						"firing":       "\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
						"num_firing":   "1",
						"num_resolved": "0",
						"resolved":     "",
					},
				},
				Client:    "Grafana",
				ClientURL: "http://localhost",
				Links:     []pagerDutyLink{{HRef: "http://localhost", Text: "External URL"}},
			},
			expMsgError: nil,
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
				Description: "[FIRING:2]  ",
				EventAction: "trigger",
				Payload: pagerDutyPayload{
					Summary:   "[FIRING:2]  ",
					Source:    hostname,
					Severity:  "warning",
					Class:     "firing",
					Component: "My Grafana",
					Group:     "my_group",
					CustomDetails: map[string]string{
						"firing":       "\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2\n",
						"num_firing":   "2",
						"num_resolved": "0",
						"resolved":     "",
					},
				},
				Client:    "Grafana",
				ClientURL: "http://localhost",
				Links:     []pagerDutyLink{{HRef: "http://localhost", Text: "External URL"}},
			},
			expMsgError: nil,
		}, {
			name:         "Error in initing",
			settings:     `{}`,
			expInitError: `could not find integration key property in settings`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)
			secureSettings := make(map[string][]byte)

			m := &NotificationChannelConfig{
				Name:           "pageduty_testing",
				Type:           "pagerduty",
				Settings:       settingsJSON,
				SecureSettings: secureSettings,
			}

			webhookSender := mockNotificationService()
			secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
			decryptFn := secretsService.GetDecryptedValue
			cfg, err := NewPagerdutyConfig(m, decryptFn)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			pn := NewPagerdutyNotifier(cfg, webhookSender, &UnavailableImageStore{}, tmpl)
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

			require.JSONEq(t, string(expBody), webhookSender.Webhook.Body)
		})
	}
}
