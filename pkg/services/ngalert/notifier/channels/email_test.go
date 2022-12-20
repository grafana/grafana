package channels

import (
	"context"
	"encoding/json"
	"net/url"
	"testing"

	"github.com/grafana/alerting/alerting/notifier/channels"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestEmailNotifier_Init(t *testing.T) {
	testCase := []struct {
		Name          string
		Config        json.RawMessage
		Expected      *emailSettings
		ExpectedError string
	}{
		{
			Name:          "error if JSON is empty",
			Config:        json.RawMessage(`{}`),
			ExpectedError: "could not find addresses in settings",
		},
		{
			Name: "should split addresses separated by semicolon",
			Config: json.RawMessage(`{
				"addresses": "someops@example.com;somedev@example.com"
			}`),
			Expected: &emailSettings{
				SingleEmail: false,
				Addresses: []string{
					"someops@example.com",
					"somedev@example.com",
				},
				Message: "",
				Subject: channels.DefaultMessageTitleEmbed,
			},
		},
		{
			Name: "should split addresses separated by comma",
			Config: json.RawMessage(`{
				"addresses": "someops@example.com,somedev@example.com"
			}`),
			Expected: &emailSettings{
				SingleEmail: false,
				Addresses: []string{
					"someops@example.com",
					"somedev@example.com",
				},
				Message: "",
				Subject: channels.DefaultMessageTitleEmbed,
			},
		},
		{
			Name: "should split addresses separated by new-line",
			Config: json.RawMessage(`{
				"addresses": "someops@example.com\nsomedev@example.com"
			}`),
			Expected: &emailSettings{
				SingleEmail: false,
				Addresses: []string{
					"someops@example.com",
					"somedev@example.com",
				},
				Message: "",
				Subject: channels.DefaultMessageTitleEmbed,
			},
		},
		{
			Name: "should split addresses separated by mixed separators",
			Config: json.RawMessage(`{
				"addresses": "someops@example.com\nsomedev@example.com;somedev2@example.com,somedev3@example.com"
			}`),
			Expected: &emailSettings{
				SingleEmail: false,
				Addresses: []string{
					"someops@example.com",
					"somedev@example.com",
					"somedev2@example.com",
					"somedev3@example.com",
				},
				Message: "",
				Subject: channels.DefaultMessageTitleEmbed,
			},
		},
		{
			Name: "should split addresses separated by mixed separators",
			Config: json.RawMessage(`{
				"addresses": "someops@example.com\nsomedev@example.com;somedev2@example.com,somedev3@example.com"
			}`),
			Expected: &emailSettings{
				SingleEmail: false,
				Addresses: []string{
					"someops@example.com",
					"somedev@example.com",
					"somedev2@example.com",
					"somedev3@example.com",
				},
				Message: "",
				Subject: channels.DefaultMessageTitleEmbed,
			},
		},
		{
			Name: "should parse all settings",
			Config: json.RawMessage(`{
			    "singleEmail": true,
				"addresses": "someops@example.com",
				"message": "test-message",
				"subject": "test-subject"
			}`),
			Expected: &emailSettings{
				SingleEmail: true,
				Addresses: []string{
					"someops@example.com",
				},
				Message: "test-message",
				Subject: "test-subject",
			},
		},
	}

	for _, test := range testCase {
		t.Run(test.Name, func(t *testing.T) {
			cfg := &channels.NotificationChannelConfig{
				Name:     "ops",
				Type:     "email",
				Settings: test.Config,
			}
			settings, err := buildEmailSettings(channels.FactoryConfig{Config: cfg})
			if test.ExpectedError != "" {
				require.ErrorContains(t, err, test.ExpectedError)
			} else {
				require.Equal(t, *test.Expected, *settings)
			}
		})
	}
}

func TestEmailNotifier_Notify(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost/base")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	t.Run("with the correct settings it should not fail and produce the expected command", func(t *testing.T) {
		jsonData := `{
			"addresses": "someops@example.com;somedev@example.com",
			"message": "{{ template \"default.title\" . }}"
		}`

		emailSender := mockNotificationService()

		fc := channels.FactoryConfig{
			Config: &channels.NotificationChannelConfig{
				Name:     "ops",
				Type:     "email",
				Settings: json.RawMessage(jsonData),
			},
			NotificationService: emailSender,
			DecryptFunc: func(ctx context.Context, sjd map[string][]byte, key string, fallback string) string {
				return fallback
			},
			ImageStore: &channels.UnavailableImageStore{},
			Template:   tmpl,
			Logger:     &channels.FakeLogger{},
		}

		emailNotifier, err := EmailFactory(fc)
		require.NoError(t, err)

		alerts := []*types.Alert{
			{
				Alert: model.Alert{
					Labels:      model.LabelSet{"alertname": "AlwaysFiring", "severity": "warning"},
					Annotations: model.LabelSet{"runbook_url": "http://fix.me", "__dashboardUid__": "abc", "__panelId__": "5"},
				},
			},
		}

		ok, err := emailNotifier.Notify(context.Background(), alerts...)
		require.NoError(t, err)
		require.True(t, ok)

		expected := map[string]interface{}{
			"subject":      emailSender.EmailSync.Subject,
			"to":           emailSender.EmailSync.To,
			"single_email": emailSender.EmailSync.SingleEmail,
			"template":     emailSender.EmailSync.Template,
			"data":         emailSender.EmailSync.Data,
		}
		require.Equal(t, map[string]interface{}{
			"subject":      "[FIRING:1]  (AlwaysFiring warning)",
			"to":           []string{"someops@example.com", "somedev@example.com"},
			"single_email": false,
			"template":     "ng_alert_notification",
			"data": map[string]interface{}{
				"Title":   "[FIRING:1]  (AlwaysFiring warning)",
				"Message": "[FIRING:1]  (AlwaysFiring warning)",
				"Status":  "firing",
				"Alerts": channels.ExtendedAlerts{
					channels.ExtendedAlert{
						Status:       "firing",
						Labels:       template.KV{"alertname": "AlwaysFiring", "severity": "warning"},
						Annotations:  template.KV{"runbook_url": "http://fix.me"},
						Fingerprint:  "15a37193dce72bab",
						SilenceURL:   "http://localhost/base/alerting/silence/new?alertmanager=grafana&matcher=alertname%3DAlwaysFiring&matcher=severity%3Dwarning",
						DashboardURL: "http://localhost/base/d/abc",
						PanelURL:     "http://localhost/base/d/abc?viewPanel=5",
					},
				},
				"GroupLabels":       template.KV{},
				"CommonLabels":      template.KV{"alertname": "AlwaysFiring", "severity": "warning"},
				"CommonAnnotations": template.KV{"runbook_url": "http://fix.me"},
				"ExternalURL":       "http://localhost/base",
				"RuleUrl":           "http://localhost/base/alerting/list",
				"AlertPageUrl":      "http://localhost/base/alerting/list?alertState=firing&view=state",
			},
		}, expected)
	})
}
