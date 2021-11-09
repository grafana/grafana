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
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var mailTemplates *template.Template
var tmplResetPassword = "reset_password"
var tmplSignUpStarted = "signup_started"
var tmplWelcomeOnSignUp = "welcome_on_signup"

func ProvideService(bus bus.Bus, cfg *setting.Cfg) (*NotificationService, error) {
	ns := &NotificationService{
		Bus:          bus,
		Cfg:          cfg,
		log:          log.New("notifications"),
		mailQueue:    make(chan *Message, 10),
		webhookQueue: make(chan *Webhook, 10),
	}

	ns.Bus.AddHandler(ns.sendResetPasswordEmail)
	ns.Bus.AddHandlerCtx(ns.validateResetPasswordCode)
	ns.Bus.AddHandler(ns.sendEmailCommandHandler)

	ns.Bus.AddHandlerCtx(ns.sendEmailCommandHandlerSync)
	ns.Bus.AddHandlerCtx(ns.SendWebhookSync)

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

type NotificationService struct {
	Bus bus.Bus
	Cfg *setting.Cfg

	mailQueue    chan *Message
	webhookQueue chan *Webhook
	log          log.Logger
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

func (ns *NotificationService) SendWebhookSync(ctx context.Context, cmd *models.SendWebhookSync) error {
	return ns.sendWebRequestSync(ctx, &Webhook{
		Url:         cmd.Url,
		User:        cmd.User,
		Password:    cmd.Password,
		Body:        cmd.Body,
		HttpMethod:  cmd.HttpMethod,
		HttpHeader:  cmd.HttpHeader,
		ContentType: cmd.ContentType,
	})
}

func subjectTemplateFunc(obj map[string]interface{}, value string) string {
	obj["value"] = value
	return ""
}

func (ns *NotificationService) sendEmailCommandHandlerSync(ctx context.Context, cmd *models.SendEmailCommandSync) error {
	message, err := ns.buildEmailMessage(&models.SendEmailCommand{
		Data:          cmd.Data,
		Info:          cmd.Info,
		Template:      cmd.Template,
		To:            cmd.To,
		SingleEmail:   cmd.SingleEmail,
		EmbeddedFiles: cmd.EmbeddedFiles,
		Subject:       cmd.Subject,
		ReplyTo:       cmd.ReplyTo,
	})

	if err != nil {
		return err
	}

	_, err = ns.Send(message)
	return err
}

func (ns *NotificationService) sendEmailCommandHandler(cmd *models.SendEmailCommand) error {
	message, err := ns.buildEmailMessage(cmd)

	if err != nil {
		return err
	}

	ns.mailQueue <- message
	return nil
}

func (ns *NotificationService) sendResetPasswordEmail(cmd *models.SendResetPasswordEmailCommand) error {
	code, err := createUserEmailCode(ns.Cfg, cmd.User, nil)
	if err != nil {
		return err
	}
	return ns.sendEmailCommandHandler(&models.SendEmailCommand{
		To:       []string{cmd.User.Email},
		Template: tmplResetPassword,
		Data: map[string]interface{}{
			"Code": code,
			"Name": cmd.User.NameOrFallback(),
		},
	})
}

func (ns *NotificationService) validateResetPasswordCode(ctx context.Context, query *models.ValidateResetPasswordCodeQuery) error {
	login := getLoginForEmailCode(query.Code)
	if login == "" {
		return models.ErrInvalidEmailCode
	}

	userQuery := models.GetUserByLoginQuery{LoginOrEmail: login}
	if err := bus.DispatchCtx(ctx, &userQuery); err != nil {
		return err
	}

	validEmailCode, err := validateUserEmailCode(ns.Cfg, userQuery.Result, query.Code)
	if err != nil {
		return err
	}
	if !validEmailCode {
		return models.ErrInvalidEmailCode
	}

	query.Result = userQuery.Result
	return nil
}

func (ns *NotificationService) signUpStartedHandler(evt *events.SignUpStarted) error {
	if !setting.VerifyEmailEnabled {
		return nil
	}

	ns.log.Info("User signup started", "email", evt.Email)

	if evt.Email == "" {
		return nil
	}

	err := ns.sendEmailCommandHandler(&models.SendEmailCommand{
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
	return bus.Dispatch(&emailSentCmd)
}

func (ns *NotificationService) signUpCompletedHandler(evt *events.SignUpCompleted) error {
	if evt.Email == "" || !ns.Cfg.Smtp.SendWelcomeEmailOnSignUp {
		return nil
	}

	return ns.sendEmailCommandHandler(&models.SendEmailCommand{
		To:       []string{evt.Email},
		Template: tmplWelcomeOnSignUp,
		Data: map[string]interface{}{
			"Name": evt.Name,
		},
	})
}
