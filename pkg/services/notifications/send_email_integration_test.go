package notifications

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestEmailIntegrationTest(t *testing.T) {
	t.Run("Given the notifications service", func(t *testing.T) {
		setting.BuildVersion = "4.0.0"

		cfg := setting.NewCfg()
		setRawKeys(t, cfg, "smtp", map[string]string{
			"enabled":      "true",
			"from_address": "from@address.com",
			"from_name":    "Grafana Admin",
		})
		setRawKeys(t, cfg, "emails", map[string]string{"content_types": "text/html, text/plain"})
		cfg.StaticRootPath = "../../../public/"
		cfg.Smtp.TemplatesPatterns = []string{"emails/*.html", "emails/*.txt"}
		cfg.Smtp.FromAddress = "from@address.com"
		ns, err := provideTestService(t, newBus(t), cfg, NewFakeMailer())
		require.NoError(t, err)

		t.Run("When sending reset email password", func(t *testing.T) {
			cmd := &SendEmailCommand{

				Data: map[string]any{
					"Title":         "[CRITICAL] Imaginary timeseries alert",
					"State":         "Firing",
					"Name":          "Imaginary timeseries alert",
					"Severity":      "ok",
					"SeverityColor": "#D63232",
					"Message":       "Alert message that will support markdown in some distant future.",
					"RuleUrl":       "http://localhost:3000/dashboard/db/graphite-dashboard",
					"ImageLink":     "http://localhost:3000/render/dashboard-solo/db/graphite-dashboard?panelId=1&from=1471008499616&to=1471012099617&width=1000&height=500",
					"AlertPageUrl":  "http://localhost:3000/alerting",
					"EmbeddedImage": "test.png",
					"EvalMatches": []map[string]string{
						{
							"Metric": "desktop",
							"Value":  "40",
						},
						{
							"Metric": "mobile",
							"Value":  "20",
						},
					},
				},
				To:       []string{"asdf@asdf.com"},
				Template: "alert_notification",
			}

			err := ns.SendEmailCommandHandler(context.Background(), cmd)
			require.NoError(t, err)

			sentMsg := <-ns.mailQueue
			require.Equal(t, "\"Grafana Admin\" <from@address.com>", sentMsg.From)
			require.Equal(t, "asdf@asdf.com", sentMsg.To[0])
			require.Equal(t, "[CRITICAL] Imaginary timeseries alert", sentMsg.Subject)
			require.Contains(t, sentMsg.Body["text/html"], "<title>[CRITICAL] Imaginary timeseries alert</title>")

			path, err := os.MkdirTemp("../../..", "tmp")
			require.NoError(t, err)
			t.Cleanup(func() {
				_ = os.RemoveAll(path)
			})
			err = os.WriteFile(path+"/test_email.html", []byte(sentMsg.Body["text/html"]), 0777)
			require.NoError(t, err)
			err = os.WriteFile(path+"/test_email.txt", []byte(sentMsg.Body["text/plain"]), 0777)
			require.NoError(t, err)
		})
	})
}
