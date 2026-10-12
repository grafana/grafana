package notifications

import (
	"context"
	"errors"
	"maps"
	"regexp"
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/events"
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
		cfg := createSmtpConfig(t)
		cfg.Smtp.FromAddress = "@notanemail@"
		_, _, err := createSutWithConfig(t, bus, cfg)

		require.Error(t, err)
	})

	t.Run("When all template_patterns fail to parse", func(t *testing.T) {
		cfg := createSmtpConfig(t)
		cfg.Smtp.TemplatesPatterns = []string{"/usr/not-a-dir/**", "/usr/also-not-a-dir/**"}
		_, _, err := createSutWithConfig(t, bus, cfg)

		require.Error(t, err)
	})

	t.Run("When some template_patterns fail to parse", func(t *testing.T) {
		cfg := createSmtpConfig(t)
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
		cfg := createSmtpConfig(t)
		setRawKeys(t, cfg, "smtp", map[string]string{"enabled": "false"})
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
		cfg := createSmtpConfig(t)
		setRawKeys(t, cfg, "emails", map[string]string{"content_types": "text/html, multipart/form-data"})
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
		cfg := createSmtpConfig(t)
		setRawKeys(t, cfg, "smtp", map[string]string{"enabled": "false"})
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
		cfg := createSmtpConfig(t)
		setRawKeys(t, cfg, "emails", map[string]string{"content_types": "text/html, multipart/form-data"})
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

func TestSendEmailFollowsLiveSettings(t *testing.T) {
	bus := newBus(t)
	newCmd := func() *SendEmailCommandSync {
		return &SendEmailCommandSync{
			SendEmailCommand: SendEmailCommand{
				Subject:  "subject",
				To:       []string{"asdf@grafana.com"},
				Template: "welcome_on_signup",
			},
		}
	}

	t.Run("sends once SMTP is enabled after startup", func(t *testing.T) {
		cfg := createSmtpConfig(t)
		setRawKeys(t, cfg, "smtp", map[string]string{"enabled": "false"})
		ns, mailer, err := createSutWithConfig(t, bus, cfg)
		require.NoError(t, err)

		require.ErrorIs(t, ns.SendEmailCommandHandlerSync(context.Background(), newCmd()), ErrSmtpNotEnabled)

		setRawKeys(t, cfg, "smtp", map[string]string{"enabled": "true"})
		require.NoError(t, ns.SendEmailCommandHandlerSync(context.Background(), newCmd()))
		assert.Len(t, mailer.Sent, 1)
	})

	t.Run("stops sending once SMTP is disabled after startup", func(t *testing.T) {
		cfg := createSmtpConfig(t)
		ns, mailer, err := createSutWithConfig(t, bus, cfg)
		require.NoError(t, err)

		require.NoError(t, ns.SendEmailCommandHandlerSync(context.Background(), newCmd()))

		setRawKeys(t, cfg, "smtp", map[string]string{"enabled": "false"})
		require.ErrorIs(t, ns.SendEmailCommandHandlerSync(context.Background(), newCmd()), ErrSmtpNotEnabled)
		assert.Len(t, mailer.Sent, 1)
	})

	t.Run("uses the sender changed after startup", func(t *testing.T) {
		cfg := createSmtpConfig(t)
		ns, mailer, err := createSutWithConfig(t, bus, cfg)
		require.NoError(t, err)

		setRawKeys(t, cfg, "smtp", map[string]string{"from_address": "new@address.com", "from_name": "New Sender"})
		require.NoError(t, ns.SendEmailCommandHandlerSync(context.Background(), newCmd()))

		require.Len(t, mailer.Sent, 1)
		assert.Equal(t, `"New Sender" <new@address.com>`, mailer.Sent[0].From)
	})

	t.Run("rejects an invalid sender changed after startup", func(t *testing.T) {
		cfg := createSmtpConfig(t)
		ns, mailer, err := createSutWithConfig(t, bus, cfg)
		require.NoError(t, err)

		setRawKeys(t, cfg, "smtp", map[string]string{"from_address": "@notanemail@"})

		require.ErrorIs(t, ns.SendEmailCommandHandlerSync(context.Background(), newCmd()), errInvalidFromAddress)
		assert.Empty(t, mailer.Sent)
	})

	t.Run("renders the content types changed after startup", func(t *testing.T) {
		cfg := createSmtpConfig(t)
		ns, mailer, err := createSutWithConfig(t, bus, cfg)
		require.NoError(t, err)

		setRawKeys(t, cfg, "emails", map[string]string{"content_types": "text/plain"})
		require.NoError(t, ns.SendEmailCommandHandlerSync(context.Background(), newCmd()))

		require.Len(t, mailer.Sent, 1)
		assert.Equal(t, []string{"text/plain"}, mailer.Sent[0].ContentTypes)
		assert.Equal(t, []string{"text/plain"}, slices.Collect(maps.Keys(mailer.Sent[0].Body)))
	})

	t.Run("returns the config provider error", func(t *testing.T) {
		providerErr := errors.New("settings unavailable")
		cfg := createSmtpConfig(t)
		ns, err := ProvideService(bus, cfg, failingConfigProvider{err: providerErr}, NewFakeMailer(), nil)
		require.NoError(t, err)

		require.ErrorIs(t, ns.SendEmailCommandHandlerSync(context.Background(), newCmd()), providerErr)
	})
}

func TestSignUpCompletedFollowsLiveWelcomeSetting(t *testing.T) {
	bus := newBus(t)
	evt := &events.SignUpCompleted{Email: "new@user.com", Name: "New User"}

	t.Run("sends the welcome email once enabled after startup", func(t *testing.T) {
		cfg := createSmtpConfig(t)
		ns, _, err := createSutWithConfig(t, bus, cfg)
		require.NoError(t, err)

		require.NoError(t, ns.signUpCompletedHandler(context.Background(), evt))
		require.Empty(t, ns.mailQueue)

		setRawKeys(t, cfg, "emails", map[string]string{"welcome_email_on_sign_up": "true"})
		require.NoError(t, ns.signUpCompletedHandler(context.Background(), evt))
		require.Len(t, ns.mailQueue, 1)
		assert.Equal(t, []string{"new@user.com"}, (<-ns.mailQueue).To)
	})

	t.Run("stops sending the welcome email once disabled after startup", func(t *testing.T) {
		cfg := createSmtpConfig(t)
		setRawKeys(t, cfg, "emails", map[string]string{"welcome_email_on_sign_up": "true"})
		ns, _, err := createSutWithConfig(t, bus, cfg)
		require.NoError(t, err)

		setRawKeys(t, cfg, "emails", map[string]string{"welcome_email_on_sign_up": "false"})
		require.NoError(t, ns.signUpCompletedHandler(context.Background(), evt))
		require.Empty(t, ns.mailQueue)
	})

	t.Run("does not fail sign-up when the SMTP settings cannot be read", func(t *testing.T) {
		cfg := createSmtpConfig(t)
		ns, err := ProvideService(bus, cfg, failingConfigProvider{err: errors.New("settings unavailable")}, NewFakeMailer(), nil)
		require.NoError(t, err)

		require.NoError(t, ns.signUpCompletedHandler(context.Background(), evt))
		require.Empty(t, ns.mailQueue)
	})
}

func createSut(t *testing.T, bus bus.Bus) (*NotificationService, *FakeMailer) {
	t.Helper()

	cfg := createSmtpConfig(t)
	ns, fm, err := createSutWithConfig(t, bus, cfg)
	require.NoError(t, err)
	return ns, fm
}

func createSutWithConfig(t *testing.T, bus bus.Bus, cfg *setting.Cfg) (*NotificationService, *FakeMailer, error) {
	smtp := NewFakeMailer()
	ns, err := provideTestService(t, bus, cfg, smtp)
	return ns, smtp, err
}

func createDisconnectedSut(t *testing.T, bus bus.Bus) *NotificationService {
	t.Helper()

	cfg := createSmtpConfig(t)
	smtp := NewFakeDisconnectedMailer()
	ns, err := provideTestService(t, bus, cfg, smtp)
	require.NoError(t, err)
	return ns
}

func provideTestService(t *testing.T, bus bus.Bus, cfg *setting.Cfg, mailer Mailer) (*NotificationService, error) {
	t.Helper()
	cfgProvider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)
	return ProvideService(bus, cfg, cfgProvider, mailer, nil)
}

// createSmtpConfig sets the SMTP settings in cfg.Raw, which the config provider
// serves at send time, and derives the startup cfg.Smtp from the same values.
func createSmtpConfig(t *testing.T) *setting.Cfg {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.StaticRootPath = "../../../public/"
	setRawKeys(t, cfg, "smtp", map[string]string{
		"enabled":      "true",
		"from_address": "from@address.com",
		"from_name":    "Grafana Admin",
	})
	setRawKeys(t, cfg, "emails", map[string]string{"content_types": "text/html, text/plain"})
	smtp, err := setting.ReadSmtpSettings(cfg.Raw, cfg.InstanceName)
	require.NoError(t, err)
	cfg.Smtp = smtp
	return cfg
}
