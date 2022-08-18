package notifications

import (
	"context"
	"errors"
	"fmt"
	"html/template"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type WebhookSender interface {
	SendWebhookSync(ctx context.Context, cmd *models.SendWebhookSync) error
}
type EmailSender interface {
	SendEmailCommandHandlerSync(ctx context.Context, cmd *models.SendEmailCommandSync) error
	SendEmailCommandHandler(ctx context.Context, cmd *models.SendEmailCommand) error
}
type Service interface {
	WebhookSender
	EmailSender
}

var mailTemplates *template.Template
var tmplResetPassword = "reset_password"
var tmplSignUpStarted = "signup_started"
var tmplWelcomeOnSignUp = "welcome_on_signup"

func ProvideService(bus bus.Bus, cfg *setting.Cfg, mailer Mailer, store TempUserStore) (*NotificationService, error) {
	ns := &NotificationService{
		Bus:          bus,
		Cfg:          cfg,
		log:          log.New("notifications"),
		mailQueue:    make(chan *Message, 10),
		webhookQueue: make(chan *Webhook, 10),
		mailer:       mailer,
		store:        store,
	}

	ns.Bus.AddEventListener(ns.signUpStartedHandler)
	ns.Bus.AddEventListener(ns.signUpCompletedHandler)

	mailTemplates = template.New("name")
	mailTemplates.Funcs(template.FuncMap{
		"Subject": subjectTemplateFunc,
	})

	for _, pattern := range ns.Cfg.Smtp.TemplatesPatterns {
		templatePattern := filepath.Join(ns.Cfg.StaticRootPath, pattern)
		_, err := mailTemplates.ParseGlob(templatePattern)
		if err != nil {
			return nil, err
		}
	}

	if !util.IsEmail(ns.Cfg.Smtp.FromAddress) {
		return nil, errors.New("invalid email address for SMTP from_address config")
	}

	if cfg.EmailCodeValidMinutes == 0 {
		cfg.EmailCodeValidMinutes = 120
	}
	return ns, nil
}

type TempUserStore interface {
	UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error
}

type NotificationService struct {
	Bus bus.Bus
	Cfg *setting.Cfg

	mailQueue    chan *Message
	webhookQueue chan *Webhook
	mailer       Mailer
	log          log.Logger
	store        TempUserStore
}

func (ns *NotificationService) Run(ctx context.Context) error {
	for {
		select {
		case webhook := <-ns.webhookQueue:
			err := ns.sendWebRequestSync(context.Background(), webhook)

			if err != nil {
				ns.log.Error("Failed to send webrequest ", "error", err)
			}
		case msg := <-ns.mailQueue:
			num, err := ns.Send(msg)
			tos := strings.Join(msg.To, "; ")
			info := ""
			if err != nil {
				if len(msg.Info) > 0 {
					info = ", info: " + msg.Info
				}
				ns.log.Error(fmt.Sprintf("Async sent email %d succeed, not send emails: %s%s err: %s", num, tos, info, err))
			} else {
				ns.log.Debug(fmt.Sprintf("Async sent email %d succeed, sent emails: %s%s", num, tos, info))
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (ns *NotificationService) GetMailer() Mailer {
	return ns.mailer
}

func (ns *NotificationService) SendWebhookSync(ctx context.Context, cmd *models.SendWebhookSync) error {
	return ns.sendWebRequestSync(ctx, &Webhook{
		Url:         cmd.Url,
		User:        cmd.User,
		Password:    cmd.Password,
		Body:        cmd.Body,
		HttpMethod:  cmd.HttpMethod,
		HttpHeader:  cmd.HttpHeader,
		ContentType: cmd.ContentType,
		Validation:  cmd.Validation,
	})
}

func subjectTemplateFunc(obj map[string]interface{}, value string) string {
	obj["value"] = value
	return ""
}

func (ns *NotificationService) SendEmailCommandHandlerSync(ctx context.Context, cmd *models.SendEmailCommandSync) error {
	message, err := ns.buildEmailMessage(&models.SendEmailCommand{
		Data:          cmd.Data,
		Info:          cmd.Info,
		Template:      cmd.Template,
		To:            cmd.To,
		SingleEmail:   cmd.SingleEmail,
		EmbeddedFiles: cmd.EmbeddedFiles,
		AttachedFiles: cmd.AttachedFiles,
		Subject:       cmd.Subject,
		ReplyTo:       cmd.ReplyTo,
	})

	if err != nil {
		return err
	}

	_, err = ns.Send(message)
	return err
}

func (ns *NotificationService) SendEmailCommandHandler(ctx context.Context, cmd *models.SendEmailCommand) error {
	message, err := ns.buildEmailMessage(cmd)

	if err != nil {
		return err
	}

	ns.mailQueue <- message
	return nil
}

func (ns *NotificationService) SendResetPasswordEmail(ctx context.Context, cmd *models.SendResetPasswordEmailCommand) error {
	code, err := createUserEmailCode(ns.Cfg, cmd.User, "")
	if err != nil {
		return err
	}
	return ns.SendEmailCommandHandler(ctx, &models.SendEmailCommand{
		To:       []string{cmd.User.Email},
		Template: tmplResetPassword,
		Data: map[string]interface{}{
			"Code": code,
			"Name": cmd.User.NameOrFallback(),
		},
	})
}

type GetUserByLoginFunc = func(c context.Context, login string) (*user.User, error)

func (ns *NotificationService) ValidateResetPasswordCode(ctx context.Context, query *models.ValidateResetPasswordCodeQuery, userByLogin GetUserByLoginFunc) error {
	login := getLoginForEmailCode(query.Code)
	if login == "" {
		return models.ErrInvalidEmailCode
	}

	user, err := userByLogin(ctx, login)
	if err != nil {
		return err
	}

	validEmailCode, err := validateUserEmailCode(ns.Cfg, user, query.Code)
	if err != nil {
		return err
	}
	if !validEmailCode {
		return models.ErrInvalidEmailCode
	}

	query.Result = user
	return nil
}

func (ns *NotificationService) signUpStartedHandler(ctx context.Context, evt *events.SignUpStarted) error {
	if !setting.VerifyEmailEnabled {
		return nil
	}

	ns.log.Info("User signup started", "email", evt.Email)

	if evt.Email == "" {
		return nil
	}

	err := ns.SendEmailCommandHandler(ctx, &models.SendEmailCommand{
		To:       []string{evt.Email},
		Template: tmplSignUpStarted,
		Data: map[string]interface{}{
			"Email":     evt.Email,
			"Code":      evt.Code,
			"SignUpUrl": setting.ToAbsUrl(fmt.Sprintf("signup/?email=%s&code=%s", url.QueryEscape(evt.Email), url.QueryEscape(evt.Code))),
		},
	})

	if err != nil {
		return err
	}

	emailSentCmd := models.UpdateTempUserWithEmailSentCommand{Code: evt.Code}
	return ns.store.UpdateTempUserWithEmailSent(ctx, &emailSentCmd)
}

func (ns *NotificationService) signUpCompletedHandler(ctx context.Context, evt *events.SignUpCompleted) error {
	if evt.Email == "" || !ns.Cfg.Smtp.SendWelcomeEmailOnSignUp {
		return nil
	}

	return ns.SendEmailCommandHandler(ctx, &models.SendEmailCommand{
		To:       []string{evt.Email},
		Template: tmplWelcomeOnSignUp,
		Data: map[string]interface{}{
			"Name": evt.Name,
		},
	})
}
