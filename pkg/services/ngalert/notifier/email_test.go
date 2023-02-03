package notifier

import (
	"context"
	"encoding/json"
	"net/url"
	"os"
	"testing"

	"github.com/grafana/alerting/images"
	alertingLogging "github.com/grafana/alerting/logging"
	"github.com/grafana/alerting/receivers"
	alertingEmail "github.com/grafana/alerting/receivers/email"
	alertingTemplates "github.com/grafana/alerting/templates"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

// TestEmailNotifierIntegration tests channels.EmailNotifier in conjunction with Grafana notifications.EmailSender and two staged expansion of the alertingEmail body
func TestEmailNotifierIntegration(t *testing.T) {
	ns := createEmailSender(t)

	emailTmpl := templateForTests(t)
	externalURL, err := url.Parse("http://localhost/base")
	require.NoError(t, err)
	emailTmpl.ExternalURL = externalURL

	cases := []struct {
		name        string
		alerts      []*types.Alert
		messageTmpl string
		subjectTmpl string
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
				"2 firing instances",
				"<strong>severity</strong>",
				"warning\n",
				"critical\n",
				"<strong>alertname</strong>",
				"FiringTwo\n",
				"FiringOne\n",
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
		{
			name: "single alert with templated subject",
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "AlwaysFiring", "severity": "warning"},
						Annotations: model.LabelSet{"runbook_url": "http://fix.me", "__dashboardUid__": "abc", "__panelId__": "5"},
					},
				},
			},
			subjectTmpl: `This notification is {{ .Status }}!`,
			expSubject:  "This notification is firing!",
			expSnippets: []string{},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			emailNotifier := createSut(t, c.messageTmpl, c.subjectTmpl, emailTmpl, ns)

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

func createSut(t *testing.T, messageTmpl string, subjectTmpl string, emailTmpl *template.Template, ns receivers.NotificationSender) *alertingEmail.Notifier {
	t.Helper()

	jsonData := map[string]interface{}{
		"addresses":   "someops@example.com;somedev@example.com",
		"singleEmail": true,
	}
	if messageTmpl != "" {
		jsonData["message"] = messageTmpl
	}

	if subjectTmpl != "" {
		jsonData["subject"] = subjectTmpl
	}
	bytes, err := json.Marshal(jsonData)
	require.NoError(t, err)

	fc := receivers.FactoryConfig{
		Config: &receivers.NotificationChannelConfig{
			Name:     "ops",
			Type:     "alertingEmail",
			Settings: json.RawMessage(bytes),
		},
		NotificationService: ns,
		DecryptFunc: func(ctx context.Context, sjd map[string][]byte, key string, fallback string) string {
			return fallback
		},
		ImageStore: &images.UnavailableImageStore{},
		Template:   emailTmpl,
		Logger:     &alertingLogging.FakeLogger{},
	}
	emailNotifier, err := alertingEmail.New(fc)
	require.NoError(t, err)
	return emailNotifier
}

func getSingleSentMessage(t *testing.T, ns *emailSender) *notifications.Message {
	t.Helper()

	mailer := ns.ns.GetMailer().(*notifications.FakeMailer)
	require.Len(t, mailer.Sent, 1)
	sent := mailer.Sent[0]
	mailer.Sent = []*notifications.Message{}
	return sent
}

type emailSender struct {
	ns *notifications.NotificationService
}

func (e emailSender) SendWebhook(ctx context.Context, cmd *receivers.SendWebhookSettings) error {
	panic("not implemented")
}

func (e emailSender) SendEmail(ctx context.Context, cmd *receivers.SendEmailSettings) error {
	attached := make([]*notifications.SendEmailAttachFile, 0, len(cmd.AttachedFiles))
	for _, file := range cmd.AttachedFiles {
		attached = append(attached, &notifications.SendEmailAttachFile{
			Name:    file.Name,
			Content: file.Content,
		})
	}
	return e.ns.SendEmailCommandHandlerSync(ctx, &notifications.SendEmailCommandSync{
		SendEmailCommand: notifications.SendEmailCommand{
			To:            cmd.To,
			SingleEmail:   cmd.SingleEmail,
			Template:      cmd.Template,
			Subject:       cmd.Subject,
			Data:          cmd.Data,
			Info:          cmd.Info,
			ReplyTo:       cmd.ReplyTo,
			EmbeddedFiles: cmd.EmbeddedFiles,
			AttachedFiles: attached,
		},
	})
}

func createEmailSender(t *testing.T) *emailSender {
	t.Helper()

	tracer := tracing.InitializeTracerForTest()
	bus := bus.ProvideBus(tracer)

	cfg := setting.NewCfg()
	cfg.StaticRootPath = "../../../../public/"
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

	return &emailSender{ns: ns}
}

func templateForTests(t *testing.T) *template.Template {
	f, err := os.CreateTemp("/tmp", "template")
	require.NoError(t, err)
	defer func(f *os.File) {
		_ = f.Close()
	}(f)

	t.Cleanup(func() {
		require.NoError(t, os.RemoveAll(f.Name()))
	})

	_, err = f.WriteString(alertingTemplates.TemplateForTestsString)
	require.NoError(t, err)

	tmpl, err := template.FromGlobs([]string{f.Name()})
	require.NoError(t, err)

	return tmpl
}
