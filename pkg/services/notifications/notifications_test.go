package notifications

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/backgroundsvcs"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNotificationService(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.StaticRootPath = "../../../public/"
	cfg.Smtp.Enabled = true
	cfg.Smtp.TemplatesPattern = "emails/*.html"
	cfg.Smtp.FromAddress = "from@address.com"
	cfg.Smtp.FromName = "Grafana Admin"

	ns, err := ProvideService(bus.New(), cfg, backgroundsvcs.ProvideService())
	require.NoError(t, err)

	t.Run("When sending reset email password", func(t *testing.T) {
		err := ns.sendResetPasswordEmail(&models.SendResetPasswordEmailCommand{User: &models.User{Email: "asd@asd.com"}})
		require.NoError(t, err)

		sentMsg := <-ns.mailQueue
		assert.Contains(t, sentMsg.Body, "body")
		assert.Equal(t, "Reset your Grafana password - asd@asd.com", sentMsg.Subject)
		assert.NotContains(t, sentMsg.Body, "Subject")
	})
}
