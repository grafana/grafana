package notifications

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNotificationService(t *testing.T) {
	ns := &NotificationService{
		Cfg: setting.NewCfg(),
	}
	ns.Cfg.StaticRootPath = "../../../public/"
	ns.Cfg.Smtp.Enabled = true
	ns.Cfg.Smtp.TemplatesPatterns = []string{"emails/*.html", "emails/*.txt"}
	ns.Cfg.Smtp.FromAddress = "from@address.com"
	ns.Cfg.Smtp.FromName = "Grafana Admin"
	ns.Cfg.Smtp.ContentTypes = []string{"text/html", "text/plain"}
	ns.Bus = bus.New()

	err := ns.Init()
	require.NoError(t, err)

	t.Run("When sending reset email password", func(t *testing.T) {
		err := ns.sendResetPasswordEmail(&models.SendResetPasswordEmailCommand{User: &models.User{Email: "asd@asd.com"}})
		require.NoError(t, err)

		sentMsg := <-ns.mailQueue
		assert.Contains(t, sentMsg.Body["text/html"], "body")
		assert.NotContains(t, sentMsg.Body["text/plain"], "body")
		assert.Equal(t, "Reset your Grafana password - asd@asd.com", sentMsg.Subject)
		assert.NotContains(t, sentMsg.Body["text/html"], "Subject")
		assert.NotContains(t, sentMsg.Body["text/plain"], "Subject")
	})
}
