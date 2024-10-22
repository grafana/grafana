package notifications

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html/template"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/Masterminds/sprig/v3"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/log"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type WebhookSender interface {
	SendWebhookSync(ctx context.Context, cmd *SendWebhookSync) error
}
type EmailSender interface {
	SendEmailCommandHandlerSync(ctx context.Context, cmd *SendEmailCommandSync) error
	SendEmailCommandHandler(ctx context.Context, cmd *SendEmailCommand) error
}
type PasswordResetMailer interface {
	SendResetPasswordEmail(ctx context.Context, cmd *SendResetPasswordEmailCommand) error
	ValidateResetPasswordCode(ctx context.Context, query *ValidateResetPasswordCodeQuery, userByLogin GetUserByLoginFunc) (*user.User, error)
}
type EmailVerificationMailer interface {
	SendVerificationEmail(ctx context.Context, cmd *SendVerifyEmailCommand) error
}
type Service interface {
	WebhookSender
	EmailSender
	PasswordResetMailer
	EmailVerificationMailer
}

var mailTemplates *template.Template

const (
	tmplResetPassword   = "reset_password"
	tmplSignUpStarted   = "signup_started"
	tmplWelcomeOnSignUp = "welcome_on_signup"
	tmplVerifyEmail     = "verify_email"
)

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
		"Subject":                 subjectTemplateFunc,
		"HiddenSubject":           hiddenSubjectTemplateFunc,
		"__dangerouslyInjectHTML": __dangerouslyInjectHTML,
	})
	mailTemplates.Funcs(sprig.FuncMap())

	// Parse invalid templates using 'or' logic. Return an error only if no paths are valid.
	invalidTemplates := make([]string, 0)
	for _, pattern := range ns.Cfg.Smtp.TemplatesPatterns {
		templatePattern := filepath.Join(ns.Cfg.StaticRootPath, pattern)
		_, err := mailTemplates.ParseGlob(templatePattern)
		if err != nil {
			invalidTemplates = append(invalidTemplates, templatePattern)
		}
	}
	if len(invalidTemplates) > 0 {
		is := strings.Join(invalidTemplates, ", ")
		if len(invalidTemplates) == len(ns.Cfg.Smtp.TemplatesPatterns) {
			return nil, fmt.Errorf("provided html/template filepaths matched no files: %s", is)
		}
		ns.log.Warn("some provided html/template filepaths matched no files: %s", is)
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
	UpdateTempUserWithEmailSent(ctx context.Context, cmd *tempuser.UpdateTempUserWithEmailSentCommand) error
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
			num, err := ns.Send(ctx, msg)
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

func (ns *NotificationService) SendWebhookSync(ctx context.Context, cmd *SendWebhookSync) error {
	return ns.sendWebRequestSync(ctx, &Webhook{
		Url:         cmd.Url,
		User:        cmd.User,
		Password:    cmd.Password,
		Body:        cmd.Body,
		HttpMethod:  cmd.HttpMethod,
		HttpHeader:  cmd.HttpHeader,
		ContentType: cmd.ContentType,
		TLSConfig:   cmd.TLSConfig,
		Validation:  cmd.Validation,
	})
}

// hiddenSubjectTemplateFunc sets the subject template (value) on the map represented by `.Subject.` (obj) so that it can be compiled and executed later.
// It returns a blank string, so there will be no resulting value left in place of the template.
func hiddenSubjectTemplateFunc(obj map[string]any, value string) string {
	obj["value"] = value
	return ""
}

// subjectTemplateFunc does the same thing has hiddenSubjectTemplateFunc, but in addition it executes and returns the subject template using the data represented in `.TemplateData` (data)
// This results in the template being replaced by the subject string.
func subjectTemplateFunc(obj map[string]any, data map[string]any, value string) string {
	obj["value"] = value

	titleTmpl, err := template.New("title").Parse(value)
	if err != nil {
		return ""
	}

	var buf bytes.Buffer
	err = titleTmpl.ExecuteTemplate(&buf, "title", data)
	if err != nil {
		return ""
	}

	subj := buf.String()
	// Since we have already executed the template, save it to subject data so we don't have to do it again later on
	obj["executed_template"] = subj
	return subj
}

// __dangerouslyInjectHTML allows marking areas of am email template as HTML safe, this will _not_ sanitize the string and will allow HTML snippets to be rendered verbatim.
// Use with absolute care as this _could_ allow for XSS attacks when used in an insecure context.
//
// It's safe to ignore gosec warning G203 when calling this function in an HTML template because we assume anyone who has write access
// to the email templates folder is an administrator.
//
// nolint:gosec
func __dangerouslyInjectHTML(s string) template.HTML {
	return template.HTML(s)
}

func (ns *NotificationService) SendEmailCommandHandlerSync(ctx context.Context, cmd *SendEmailCommandSync) error {
	message, err := ns.buildEmailMessage(&SendEmailCommand{
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

	_, err = ns.Send(ctx, message)
	return err
}

func (ns *NotificationService) SendEmailCommandHandler(ctx context.Context, cmd *SendEmailCommand) error {
	message, err := ns.buildEmailMessage(cmd)
	if err != nil {
		return err
	}

	ns.mailQueue <- message
	return nil
}

func (ns *NotificationService) SendResetPasswordEmail(ctx context.Context, cmd *SendResetPasswordEmailCommand) error {
	code, err := createUserEmailCode(ns.Cfg, cmd.User, "")
	if err != nil {
		return err
	}
	return ns.SendEmailCommandHandler(ctx, &SendEmailCommand{
		To:       []string{cmd.User.Email},
		Template: tmplResetPassword,
		Data: map[string]any{
			"Code": code,
			"Name": cmd.User.NameOrFallback(),
		},
	})
}

type GetUserByLoginFunc = func(c context.Context, login string) (*user.User, error)

func (ns *NotificationService) ValidateResetPasswordCode(ctx context.Context, query *ValidateResetPasswordCodeQuery, userByLogin GetUserByLoginFunc) (*user.User, error) {
	login := getLoginForEmailCode(query.Code)
	if login == "" {
		return nil, ErrInvalidEmailCode
	}

	user, err := userByLogin(ctx, login)
	if err != nil {
		return nil, err
	}

	validEmailCode, err := validateUserEmailCode(ns.Cfg, user, query.Code)
	if err != nil {
		return nil, err
	}
	if !validEmailCode {
		return nil, ErrInvalidEmailCode
	}

	return user, nil
}

func (ns *NotificationService) SendVerificationEmail(ctx context.Context, cmd *SendVerifyEmailCommand) error {
	return ns.SendEmailCommandHandlerSync(ctx, &SendEmailCommandSync{
		SendEmailCommand: SendEmailCommand{
			To:       []string{cmd.Email},
			Template: tmplVerifyEmail,
			Data: map[string]any{
				"Code":                           url.QueryEscape(cmd.Code),
				"Name":                           cmd.User.Name,
				"VerificationEmailLifetimeHours": int(ns.Cfg.VerificationEmailMaxLifetime.Hours()),
			},
		},
	})
}

func (ns *NotificationService) signUpStartedHandler(ctx context.Context, evt *events.SignUpStarted) error {
	if !ns.Cfg.VerifyEmailEnabled {
		return nil
	}

	ns.log.Info("User signup started", "email", evt.Email)

	if evt.Email == "" {
		return nil
	}

	err := ns.SendEmailCommandHandler(ctx, &SendEmailCommand{
		To:       []string{evt.Email},
		Template: tmplSignUpStarted,
		Data: map[string]any{
			"Email":     evt.Email,
			"Code":      evt.Code,
			"SignUpUrl": setting.ToAbsUrl(fmt.Sprintf("signup/?email=%s&code=%s", url.QueryEscape(evt.Email), url.QueryEscape(evt.Code))),
		},
	})
	if err != nil {
		return err
	}

	emailSentCmd := tempuser.UpdateTempUserWithEmailSentCommand{Code: evt.Code}
	return ns.store.UpdateTempUserWithEmailSent(ctx, &emailSentCmd)
}

func (ns *NotificationService) signUpCompletedHandler(ctx context.Context, evt *events.SignUpCompleted) error {
	if evt.Email == "" || !ns.Cfg.Smtp.SendWelcomeEmailOnSignUp {
		return nil
	}

	return ns.SendEmailCommandHandler(ctx, &SendEmailCommand{
		To:       []string{evt.Email},
		Template: tmplWelcomeOnSignUp,
		Data: map[string]any{
			"Name": evt.Name,
		},
	})
}
