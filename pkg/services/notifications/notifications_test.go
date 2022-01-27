package notifications

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProvideService(t *testing.T) {
	bus := bus.New()

	t.Run("When invalid from_address in configuration", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.FromAddress = "@notanemail@"
		_, _, err := createSutWithConfig(bus, cfg)

		require.Error(t, err)
	})

	t.Run("When template_patterns fails to parse", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.TemplatesPatterns = append(cfg.Smtp.TemplatesPatterns, "/usr/not-a-dir/**")
		_, _, err := createSutWithConfig(bus, cfg)

		require.Error(t, err)
	})
}

func TestSendEmailSync(t *testing.T) {
	bus := bus.New()

	t.Run("When sending emails synchronously", func(t *testing.T) {
		_, mailer := createSut(t, bus)
		cmd := &models.SendEmailCommandSync{
			SendEmailCommand: models.SendEmailCommand{
				Subject:     "subject",
				To:          []string{"asdf@grafana.com"},
				SingleEmail: false,
				Template:    "welcome_on_signup",
			},
		}

		err := bus.Dispatch(context.Background(), cmd)
		require.NoError(t, err)

		require.NotEmpty(t, mailer.Sent)
		sent := mailer.Sent[len(mailer.Sent)-1]
		require.Equal(t, "subject", sent.Subject)
		require.Equal(t, []string{"asdf@grafana.com"}, sent.To)
	})

	t.Run("When using Single Email mode with multiple recipients", func(t *testing.T) {
		_, mailer := createSut(t, bus)
		cmd := &models.SendEmailCommandSync{
			SendEmailCommand: models.SendEmailCommand{
				Subject:     "subject",
				To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
				SingleEmail: true,
				Template:    "welcome_on_signup",
			},
		}

		err := bus.Dispatch(context.Background(), cmd)
		require.NoError(t, err)

		require.Len(t, mailer.Sent, 1)
	})

	t.Run("When using Multi Email mode with multiple recipients", func(t *testing.T) {
		_, mailer := createSut(t, bus)
		cmd := &models.SendEmailCommandSync{
			SendEmailCommand: models.SendEmailCommand{
				Subject:     "subject",
				To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
				SingleEmail: false,
				Template:    "welcome_on_signup",
			},
		}

		err := bus.Dispatch(context.Background(), cmd)
		require.NoError(t, err)

		require.Len(t, mailer.Sent, 3)
	})

	t.Run("When attaching files to emails", func(t *testing.T) {
		_, mailer := createSut(t, bus)
		cmd := &models.SendEmailCommandSync{
			SendEmailCommand: models.SendEmailCommand{
				Subject:     "subject",
				To:          []string{"asdf@grafana.com"},
				SingleEmail: true,
				Template:    "welcome_on_signup",
				AttachedFiles: []*models.SendEmailAttachFile{
					{
						Name:    "attachment.txt",
						Content: []byte("text file content"),
					},
				},
			},
		}

		err := bus.Dispatch(context.Background(), cmd)
		require.NoError(t, err)

		require.NotEmpty(t, mailer.Sent)
		sent := mailer.Sent[len(mailer.Sent)-1]
		require.Len(t, sent.AttachedFiles, 1)
		file := sent.AttachedFiles[len(sent.AttachedFiles)-1]
		require.Equal(t, "attachment.txt", file.Name)
		require.Equal(t, []byte("text file content"), file.Content)
	})

	t.Run("When SMTP disabled in configuration", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.Enabled = false
		_, mailer, err := createSutWithConfig(bus, cfg)
		require.NoError(t, err)
		cmd := &models.SendEmailCommandSync{
			SendEmailCommand: models.SendEmailCommand{
				Subject:     "subject",
				To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
				SingleEmail: true,
				Template:    "welcome_on_signup",
			},
		}

		err = bus.Dispatch(context.Background(), cmd)

		require.ErrorIs(t, err, models.ErrSmtpNotEnabled)
		require.Empty(t, mailer.Sent)
	})

	t.Run("When invalid content type in configuration", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.ContentTypes = append(cfg.Smtp.ContentTypes, "multipart/form-data")
		_, mailer, err := createSutWithConfig(bus, cfg)
		require.NoError(t, err)
		cmd := &models.SendEmailCommandSync{
			SendEmailCommand: models.SendEmailCommand{
				Subject:     "subject",
				To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
				SingleEmail: false,
				Template:    "welcome_on_signup",
			},
		}

		err = bus.Dispatch(context.Background(), cmd)

		require.Error(t, err)
		require.Empty(t, mailer.Sent)
	})

	t.Run("When SMTP dialer is disconnected", func(t *testing.T) {
		_ = createDisconnectedSut(t, bus)
		cmd := &models.SendEmailCommandSync{
			SendEmailCommand: models.SendEmailCommand{
				Subject:     "subject",
				To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
				SingleEmail: false,
				Template:    "welcome_on_signup",
			},
		}

		err := bus.Dispatch(context.Background(), cmd)

		require.Error(t, err)
	})
}

func TestSendEmailAsync(t *testing.T) {
	bus := bus.New()

	t.Run("When sending reset email password", func(t *testing.T) {
		sut, _ := createSut(t, bus)
		err := sut.sendResetPasswordEmail(context.Background(), &models.SendResetPasswordEmailCommand{User: &models.User{Email: "asd@asd.com"}})
		require.NoError(t, err)

		sentMsg := <-sut.mailQueue
		assert.Contains(t, sentMsg.Body["text/html"], "body")
		assert.NotContains(t, sentMsg.Body["text/plain"], "body")
		assert.Equal(t, "Reset your Grafana password - asd@asd.com", sentMsg.Subject)
		assert.NotContains(t, sentMsg.Body["text/html"], "Subject")
		assert.NotContains(t, sentMsg.Body["text/plain"], "Subject")
	})

	t.Run("When SMTP disabled in configuration", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.Enabled = false
		_, mailer, err := createSutWithConfig(bus, cfg)
		require.NoError(t, err)
		cmd := &models.SendEmailCommand{
			Subject:     "subject",
			To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
			SingleEmail: true,
			Template:    "welcome_on_signup",
		}

		err = bus.Dispatch(context.Background(), cmd)

		require.ErrorIs(t, err, models.ErrSmtpNotEnabled)
		require.Empty(t, mailer.Sent)
	})

	t.Run("When invalid content type in configuration", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.ContentTypes = append(cfg.Smtp.ContentTypes, "multipart/form-data")
		_, mailer, err := createSutWithConfig(bus, cfg)
		require.NoError(t, err)
		cmd := &models.SendEmailCommand{
			Subject:     "subject",
			To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
			SingleEmail: false,
			Template:    "welcome_on_signup",
		}

		err = bus.Dispatch(context.Background(), cmd)

		require.Error(t, err)
		require.Empty(t, mailer.Sent)
	})

	t.Run("When SMTP dialer is disconnected", func(t *testing.T) {
		_ = createDisconnectedSut(t, bus)
		cmd := &models.SendEmailCommand{
			Subject:     "subject",
			To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
			SingleEmail: false,
			Template:    "welcome_on_signup",
		}

		err := bus.Dispatch(context.Background(), cmd)

		// The async version should not surface connection errors via Bus. It should only log them.
		require.NoError(t, err)
	})
}

func createSut(t *testing.T, bus bus.Bus) (*NotificationService, *FakeMailer) {
	t.Helper()

	cfg := createSmtpConfig()
	ns, fm, err := createSutWithConfig(bus, cfg)
	require.NoError(t, err)
	return ns, fm
}

func createSutWithConfig(bus bus.Bus, cfg *setting.Cfg) (*NotificationService, *FakeMailer, error) {
	smtp := NewFakeMailer()
	ns, err := ProvideService(bus, cfg, smtp)
	return ns, smtp, err
}

func createDisconnectedSut(t *testing.T, bus bus.Bus) *NotificationService {
	t.Helper()

	cfg := createSmtpConfig()
	smtp := NewFakeDisconnectedMailer()
	ns, err := ProvideService(bus, cfg, smtp)
	require.NoError(t, err)
	return ns
}

func createSmtpConfig() *setting.Cfg {
	cfg := setting.NewCfg()
	cfg.StaticRootPath = "../../../public/"
	cfg.Smtp.Enabled = true
	cfg.Smtp.TemplatesPatterns = []string{"emails/*.html", "emails/*.txt"}
	cfg.Smtp.FromAddress = "from@address.com"
	cfg.Smtp.FromName = "Grafana Admin"
	cfg.Smtp.ContentTypes = []string{"text/html", "text/plain"}
	return cfg
}
