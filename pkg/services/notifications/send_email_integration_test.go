package notifications

import (
	"io/ioutil"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestEmailIntegrationTest(t *testing.T) {
	t.Run("Given the notifications service", func(t *testing.T) {
		t.Skip("Skip test Given the notifications service")
		setting.StaticRootPath = "../../../public/"
		setting.BuildVersion = "4.0.0"

		ns := &NotificationService{}
		ns.Bus = bus.New()
		ns.Cfg = setting.NewCfg()
		ns.Cfg.Smtp.Enabled = true
		ns.Cfg.Smtp.TemplatesPattern = "emails/*.html"
		ns.Cfg.Smtp.FromAddress = "from@address.com"
		ns.Cfg.Smtp.FromName = "Grafana Admin"

		err := ns.Init()
		require.NoError(t, err)

		t.Run("When sending reset email password", func(t *testing.T) {
			cmd := &models.SendEmailCommand{

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
				Template: "alert_notification.html",
			}

			err := ns.sendEmailCommandHandler(cmd)
			require.NoError(t, err)

			sentMsg := <-ns.mailQueue
			require.Equal(t, "Grafana Admin <from@address.com>", sentMsg.From)
			require.Equal(t, "asdf@asdf.com", sentMsg.To[0])
			err = ioutil.WriteFile("../../../tmp/test_email.html", []byte(sentMsg.Body), 0777)
			require.NoError(t, err)
		})
	})
}
