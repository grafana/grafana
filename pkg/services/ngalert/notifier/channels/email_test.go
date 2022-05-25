package channels

import (
	"context"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

func TestEmailNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost/base")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	t.Run("empty settings should return error", func(t *testing.T) {
		json := `{ }`

		settingsJSON, _ := simplejson.NewJson([]byte(json))
		model := &NotificationChannelConfig{
			Name:     "ops",
			Type:     "email",
			Settings: settingsJSON,
		}

		_, err := NewEmailConfig(model)
		require.Error(t, err)
	})

	t.Run("with the correct settings it should not fail and produce the expected command", func(t *testing.T) {
		json := `{
			"addresses": "someops@example.com;somedev@example.com",
			"message": "{{ template \"default.title\" . }}"
		}`
		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)

		emailSender := mockNotificationService()
		cfg, err := NewEmailConfig(&NotificationChannelConfig{
			Name:     "ops",
			Type:     "email",
			Settings: settingsJSON,
		})
		require.NoError(t, err)
		emailNotifier := NewEmailNotifier(cfg, emailSender, &UnavailableImageStore{}, tmpl)

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
				"Alerts": ExtendedAlerts{
					ExtendedAlert{
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

func TestEmailNotifierIntegration(t *testing.T) {
	ns := createCoreEmailService(t)

	emailTmpl := templateForTests(t)
	externalURL, err := url.Parse("http://localhost/base")
	require.NoError(t, err)
	emailTmpl.ExternalURL = externalURL

	cases := []struct {
		name        string
		alerts      []*types.Alert
		messageTmpl string
		expSubject  string
		expSnippets []string
	}{
		{
			name: "single alert with templated message",
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "AlwaysFiring", "severity": "warning"},
						Annotations: model.LabelSet{"runbook_url": "http://fix.me", "__dashboardUid__": "abc", "__panelId__": "5"},
					},
				},
			},
			messageTmpl: `Hi, this is a custom template.
				{{ if gt (len .Alerts.Firing) 0 }}
					You have {{ len .Alerts.Firing }} alerts firing.
					{{ range .Alerts.Firing }} Firing: {{ .Labels.alertname }} at {{ .Labels.severity }} {{ end }}
				{{ end }}`,
			expSubject: "[FIRING:1]  (AlwaysFiring warning)",
			expSnippets: []string{
				"Hi, this is a custom template.",
				"You have 1 alerts firing.",
				"Firing: AlwaysFiring at warning",
			},
		},
		{
			name: "multiple alerts with templated message",
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "FiringOne", "severity": "warning"},
						Annotations: model.LabelSet{"runbook_url": "http://fix.me", "__dashboardUid__": "abc", "__panelId__": "5"},
					},
				},
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "FiringTwo", "severity": "critical"},
						Annotations: model.LabelSet{"runbook_url": "http://fix.me", "__dashboardUid__": "abc", "__panelId__": "5"},
					},
				},
			},
			messageTmpl: `Hi, this is a custom template.
				{{ if gt (len .Alerts.Firing) 0 }}
					You have {{ len .Alerts.Firing }} alerts firing.
					{{ range .Alerts.Firing }} Firing: {{ .Labels.alertname }} at {{ .Labels.severity }} {{ end }}
				{{ end }}`,
			expSubject: "[FIRING:2]  ",
			expSnippets: []string{
				"Hi, this is a custom template.",
				"You have 2 alerts firing.",
				"Firing: FiringOne at warning",
				"Firing: FiringTwo at critical",
			},
		},
		{
			name: "empty message with alerts uses default template content",
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "FiringOne", "severity": "warning"},
						Annotations: model.LabelSet{"runbook_url": "http://fix.me", "__dashboardUid__": "abc", "__panelId__": "5"},
					},
				},
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "FiringTwo", "severity": "critical"},
						Annotations: model.LabelSet{"runbook_url": "http://fix.me", "__dashboardUid__": "abc", "__panelId__": "5"},
					},
				},
			},
			messageTmpl: "",
			expSubject:  "[FIRING:2]  ",
			expSnippets: []string{
				"Firing: 2 alerts",
				"<li>alertname: FiringOne</li><li>severity: warning</li>",
				"<li>alertname: FiringTwo</li><li>severity: critical</li>",
				"<a href=\"http://fix.me\"",
				"<a href=\"http://localhost/base/d/abc",
				"<a href=\"http://localhost/base/d/abc?viewPanel=5",
			},
		},
		{
			name: "message containing HTML gets HTMLencoded",
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "AlwaysFiring", "severity": "warning"},
						Annotations: model.LabelSet{"runbook_url": "http://fix.me", "__dashboardUid__": "abc", "__panelId__": "5"},
					},
				},
			},
			messageTmpl: `<marquee>Hi, this is a custom template.</marquee>
				{{ if gt (len .Alerts.Firing) 0 }}
					<ol>
					{{range .Alerts.Firing }}<li>Firing: {{ .Labels.alertname }} at {{ .Labels.severity }} </li> {{ end }}
					</ol>
				{{ end }}`,
			expSubject: "[FIRING:1]  (AlwaysFiring warning)",
			expSnippets: []string{
				"&lt;marquee&gt;Hi, this is a custom template.&lt;/marquee&gt;",
				"&lt;li&gt;Firing: AlwaysFiring at warning &lt;/li&gt;",
			},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			emailNotifier := createSut(t, c.messageTmpl, emailTmpl, ns)

			ok, err := emailNotifier.Notify(context.Background(), c.alerts...)
			require.NoError(t, err)
			require.True(t, ok)

			sentMsg := getSingleSentMessage(t, ns)

			require.NotNil(t, sentMsg)

			require.Equal(t, "\"Grafana Admin\" <from@address.com>", sentMsg.From)
			require.Equal(t, sentMsg.To[0], "someops@example.com")

			require.Equal(t, c.expSubject, sentMsg.Subject)

			require.Contains(t, sentMsg.Body, "text/html")
			html := sentMsg.Body["text/html"]
			require.NotNil(t, html)

			for _, s := range c.expSnippets {
				require.Contains(t, html, s)
			}
		})
	}
}

func createCoreEmailService(t *testing.T) *notifications.NotificationService {
	t.Helper()

	bus := bus.New()
	cfg := setting.NewCfg()
	cfg.StaticRootPath = "../../../../../public/"
	cfg.BuildVersion = "4.0.0"
	cfg.Smtp.Enabled = true
	cfg.Smtp.TemplatesPatterns = []string{"emails/*.html", "emails/*.txt"}
	cfg.Smtp.FromAddress = "from@address.com"
	cfg.Smtp.FromName = "Grafana Admin"
	cfg.Smtp.ContentTypes = []string{"text/html", "text/plain"}
	cfg.Smtp.Host = "localhost:1234"
	mailer := notifications.NewFakeMailer()

	ns, err := notifications.ProvideService(bus, cfg, mailer, nil)
	require.NoError(t, err)

	return ns
}

func createSut(t *testing.T, messageTmpl string, emailTmpl *template.Template, ns notifications.EmailSender) *EmailNotifier {
	t.Helper()

	json := `{
		"addresses": "someops@example.com;somedev@example.com",
		"singleEmail": true
	}`
	settingsJSON, err := simplejson.NewJson([]byte(json))
	if messageTmpl != "" {
		settingsJSON.Set("message", messageTmpl)
	}
	require.NoError(t, err)
	cfg, err := NewEmailConfig(&NotificationChannelConfig{
		Name:     "ops",
		Type:     "email",
		Settings: settingsJSON,
	})
	require.NoError(t, err)
	emailNotifier := NewEmailNotifier(cfg, ns, &UnavailableImageStore{}, emailTmpl)

	return emailNotifier
}

func getSingleSentMessage(t *testing.T, ns *notifications.NotificationService) *notifications.Message {
	t.Helper()

	mailer := ns.GetMailer().(*notifications.FakeMailer)
	require.Len(t, mailer.Sent, 1)
	sent := mailer.Sent[0]
	mailer.Sent = []*notifications.Message{}
	return sent
}
