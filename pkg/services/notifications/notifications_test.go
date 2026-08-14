package notifications

import (
	"context"
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func newBus(t *testing.T) bus.Bus {
	t.Helper()
	tracer := tracing.InitializeTracerForTest()
	return bus.ProvideBus(tracer)
}

func TestProvideService(t *testing.T) {
	bus := newBus(t)

	t.Run("When invalid from_address in configuration", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.FromAddress = "@notanemail@"
		_, _, err := createSutWithConfig(t, bus, cfg)

		require.Error(t, err)
	})

	t.Run("When all template_patterns fail to parse", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.TemplatesPatterns = []string{"/usr/not-a-dir/**", "/usr/also-not-a-dir/**"}
		_, _, err := createSutWithConfig(t, bus, cfg)

		require.Error(t, err)
	})

	t.Run("When some template_patterns fail to parse", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.TemplatesPatterns = append(cfg.Smtp.TemplatesPatterns, "/usr/not-a-dir/**")
		_, _, err := createSutWithConfig(t, bus, cfg)

		require.NoError(t, err)
	})
}

func TestSendEmailSync(t *testing.T) {
	bus := newBus(t)

	t.Run("When sending emails synchronously", func(t *testing.T) {
		ns, mailer := createSut(t, bus)
		cmd := &SendEmailCommandSync{
			SendEmailCommand: SendEmailCommand{
				Subject:     "subject",
				To:          []string{"asdf@grafana.com"},
				SingleEmail: false,
				Template:    "welcome_on_signup",
			},
		}
		err := ns.SendEmailCommandHandlerSync(context.Background(), cmd)
		require.NoError(t, err)

		require.NotEmpty(t, mailer.Sent)
		sent := mailer.Sent[len(mailer.Sent)-1]
		require.Equal(t, "subject", sent.Subject)
		require.Equal(t, []string{"asdf@grafana.com"}, sent.To)
	})

	t.Run("When using Single Email mode with multiple recipients", func(t *testing.T) {
		ns, mailer := createSut(t, bus)
		cmd := &SendEmailCommandSync{
			SendEmailCommand: SendEmailCommand{
				Subject:     "subject",
				To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
				SingleEmail: true,
				Template:    "welcome_on_signup",
			},
		}

		err := ns.SendEmailCommandHandlerSync(context.Background(), cmd)
		require.NoError(t, err)

		require.Len(t, mailer.Sent, 1)
	})

	t.Run("When using Multi Email mode with multiple recipients", func(t *testing.T) {
		ns, mailer := createSut(t, bus)
		cmd := &SendEmailCommandSync{
			SendEmailCommand: SendEmailCommand{
				Subject:     "subject",
				To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
				SingleEmail: false,
				Template:    "welcome_on_signup",
			},
		}

		err := ns.SendEmailCommandHandlerSync(context.Background(), cmd)
		require.NoError(t, err)

		require.Len(t, mailer.Sent, 3)
	})

	t.Run("When attaching files to emails", func(t *testing.T) {
		ns, mailer := createSut(t, bus)
		cmd := &SendEmailCommandSync{
			SendEmailCommand: SendEmailCommand{
				Subject:     "subject",
				To:          []string{"asdf@grafana.com"},
				SingleEmail: true,
				Template:    "welcome_on_signup",
				AttachedFiles: []*SendEmailAttachFile{
					{
						Name:    "attachment.txt",
						Content: []byte("text file content"),
					},
				},
			},
		}

		err := ns.SendEmailCommandHandlerSync(context.Background(), cmd)
		require.NoError(t, err)

		require.NotEmpty(t, mailer.Sent)
		sent := mailer.Sent[len(mailer.Sent)-1]
		require.Len(t, sent.AttachedFiles, 1)
		file := sent.AttachedFiles[len(sent.AttachedFiles)-1]
		require.Equal(t, "attachment.txt", file.Name)
		require.Equal(t, []byte("text file content"), file.Content)
	})

	t.Run("When embedding readers to emails", func(t *testing.T) {
		ns, mailer := createSut(t, bus)
		cmd := &SendEmailCommandSync{
			SendEmailCommand: SendEmailCommand{
				Subject:     "subject",
				To:          []string{"asdf@grafana.com"},
				SingleEmail: true,
				Template:    "welcome_on_signup",
				EmbeddedContents: []EmbeddedContent{
					{Name: "embed.jpg", Content: []byte("image content")},
				},
			},
		}

		err := ns.SendEmailCommandHandlerSync(context.Background(), cmd)
		require.NoError(t, err)

		require.NotEmpty(t, mailer.Sent)
		sent := mailer.Sent[len(mailer.Sent)-1]
		require.Len(t, sent.EmbeddedContents, 1)
		f := sent.EmbeddedContents[0]
		require.Equal(t, "embed.jpg", f.Name)
		require.Equal(t, "image content", string(f.Content))
	})

	t.Run("When SMTP disabled in configuration", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.Enabled = false
		ns, mailer, err := createSutWithConfig(t, bus, cfg)
		require.NoError(t, err)
		cmd := &SendEmailCommandSync{
			SendEmailCommand: SendEmailCommand{
				Subject:     "subject",
				To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
				SingleEmail: true,
				Template:    "welcome_on_signup",
			},
		}

		err = ns.SendEmailCommandHandlerSync(context.Background(), cmd)

		require.ErrorIs(t, err, ErrSmtpNotEnabled)
		require.Empty(t, mailer.Sent)
	})

	t.Run("When invalid content type in configuration", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.ContentTypes = append(cfg.Smtp.ContentTypes, "multipart/form-data")
		ns, mailer, err := createSutWithConfig(t, bus, cfg)
		require.NoError(t, err)
		cmd := &SendEmailCommandSync{
			SendEmailCommand: SendEmailCommand{
				Subject:     "subject",
				To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
				SingleEmail: false,
				Template:    "welcome_on_signup",
			},
		}

		err = ns.SendEmailCommandHandlerSync(context.Background(), cmd)

		require.Error(t, err)
		require.Empty(t, mailer.Sent)
	})

	t.Run("When SMTP dialer is disconnected", func(t *testing.T) {
		ns := createDisconnectedSut(t, bus)
		cmd := &SendEmailCommandSync{
			SendEmailCommand: SendEmailCommand{
				Subject:     "subject",
				To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
				SingleEmail: false,
				Template:    "welcome_on_signup",
			},
		}

		err := ns.SendEmailCommandHandlerSync(context.Background(), cmd)

		require.Error(t, err)
	})
}

func TestSendEmailAsync(t *testing.T) {
	bus := newBus(t)

	t.Run("When sending reset email password", func(t *testing.T) {
		sut, _ := createSut(t, bus)
		testuser := user.User{Email: "asd@asd.com", Login: "asd@asd.com"}
		err := sut.SendResetPasswordEmail(context.Background(), &SendResetPasswordEmailCommand{User: &testuser})

		require.NoError(t, err)

		sentMsg := <-sut.mailQueue
		assert.Contains(t, sentMsg.Body["text/html"], "body")
		assert.NotContains(t, sentMsg.Body["text/plain"], "body")
		assert.Equal(t, "Reset your Grafana password - asd@asd.com", sentMsg.Subject)
		assert.NotContains(t, sentMsg.Body["text/html"], "Subject")
		assert.NotContains(t, sentMsg.Body["text/plain"], "Subject")

		// find code in mail
		r, _ := regexp.Compile(`code=(\w+)`)
		match := r.FindString(sentMsg.Body["text/plain"])
		code := match[len("code="):]

		// verify code
		query := ValidateResetPasswordCodeQuery{Code: code}
		getUserByLogin := func(ctx context.Context, login string) (*user.User, error) {
			return &testuser, nil
		}
		_, err = sut.ValidateResetPasswordCode(context.Background(), &query, getUserByLogin)
		require.NoError(t, err)
	})

	t.Run("When SMTP disabled in configuration", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.Enabled = false
		ns, mailer, err := createSutWithConfig(t, bus, cfg)
		require.NoError(t, err)
		cmd := &SendEmailCommand{
			Subject:     "subject",
			To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
			SingleEmail: true,
			Template:    "welcome_on_signup",
		}

		err = ns.SendEmailCommandHandler(context.Background(), cmd)

		require.ErrorIs(t, err, ErrSmtpNotEnabled)
		require.Empty(t, mailer.Sent)
	})

	t.Run("When invalid content type in configuration", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.ContentTypes = append(cfg.Smtp.ContentTypes, "multipart/form-data")
		ns, mailer, err := createSutWithConfig(t, bus, cfg)
		require.NoError(t, err)
		cmd := &SendEmailCommand{
			Subject:     "subject",
			To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
			SingleEmail: false,
			Template:    "welcome_on_signup",
		}

		err = ns.SendEmailCommandHandler(context.Background(), cmd)

		require.Error(t, err)
		require.Empty(t, mailer.Sent)
	})

	t.Run("When SMTP dialer is disconnected", func(t *testing.T) {
		ns := createDisconnectedSut(t, bus)
		cmd := &SendEmailCommand{
			Subject:     "subject",
			To:          []string{"1@grafana.com", "2@grafana.com", "3@grafana.com"},
			SingleEmail: false,
			Template:    "welcome_on_signup",
		}

		err := ns.SendEmailCommandHandler(context.Background(), cmd)

		// The async version should not surface connection errors via Bus. It should only log them.
		require.NoError(t, err)
	})
}

func createSut(t *testing.T, bus bus.Bus) (*NotificationService, *FakeMailer) {
	t.Helper()

	cfg := createSmtpConfig()
	ns, fm, err := createSutWithConfig(t, bus, cfg)
	require.NoError(t, err)
	return ns, fm
}

func createSutWithConfig(t *testing.T, bus bus.Bus, cfg *setting.Cfg) (*NotificationService, *FakeMailer, error) {
	smtp := NewFakeMailer()
	ns, err := ProvideService(bus, cfg, smtp, nil)
	return ns, smtp, err
}

func createDisconnectedSut(t *testing.T, bus bus.Bus) *NotificationService {
	t.Helper()

	cfg := createSmtpConfig()
	smtp := NewFakeDisconnectedMailer()
	ns, err := ProvideService(bus, cfg, smtp, nil)
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
