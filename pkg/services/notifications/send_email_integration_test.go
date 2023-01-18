package notifications

import (
	"context"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

func TestEmailIntegrationTest(t *testing.T) {
	t.Run("Given the notifications service", func(t *testing.T) {
		t.Skip()

		setting.StaticRootPath = "../../../public/"
		setting.BuildVersion = "4.0.0"

		ns := &NotificationService{}
		ns.Bus = newBus(t)
		ns.Cfg = setting.NewCfg()
		ns.Cfg.Smtp.Enabled = true
		ns.Cfg.Smtp.TemplatesPatterns = []string{"emails/*.html", "emails/*.txt"}
		ns.Cfg.Smtp.FromAddress = "from@address.com"
		ns.Cfg.Smtp.FromName = "Grafana Admin"
		ns.Cfg.Smtp.ContentTypes = []string{"text/html", "text/plain"}

		t.Run("When sending reset email password", func(t *testing.T) {
			cmd := &SendEmailCommand{

				Data: map[string]interface{}{
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
			require.Equal(t, sentMsg.From, "Grafana Admin <from@address.com>")
			require.Equal(t, sentMsg.To[0], "asdf@asdf.com")
			err = os.WriteFile("../../../tmp/test_email.html", []byte(sentMsg.Body["text/html"]), 0777)
			require.NoError(t, err)
			err = os.WriteFile("../../../tmp/test_email.txt", []byte(sentMsg.Body["text/plain"]), 0777)
			require.NoError(t, err)
		})
	})
}
