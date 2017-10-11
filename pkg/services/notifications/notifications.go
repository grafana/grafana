package notifications

import (
	"context"
	"errors"
	"fmt"
	"html/template"
	"net/url"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var mailTemplates *template.Template
var tmplResetPassword = "reset_password.html"
var tmplSignUpStarted = "signup_started.html"
var tmplWelcomeOnSignUp = "welcome_on_signup.html"

func Init() error {
	initMailQueue()
	initWebhookQueue()

	bus.AddHandler("email", sendResetPasswordEmail)
	bus.AddHandler("email", validateResetPasswordCode)
	bus.AddHandler("email", sendEmailCommandHandler)

	bus.AddCtxHandler("email", sendEmailCommandHandlerSync)

	bus.AddCtxHandler("webhook", SendWebhookSync)

	bus.AddEventListener(signUpStartedHandler)
	bus.AddEventListener(signUpCompletedHandler)

	mailTemplates = template.New("name")
	mailTemplates.Funcs(template.FuncMap{
		"Subject": subjectTemplateFunc,
	})

	templatePattern := filepath.Join(setting.StaticRootPath, setting.Smtp.TemplatesPattern)
	_, err := mailTemplates.ParseGlob(templatePattern)
	if err != nil {
		return err
	}

	if !util.IsEmail(setting.Smtp.FromAddress) {
		return errors.New("Invalid email address for SMTP from_address config")
	}

	if setting.EmailCodeValidMinutes == 0 {
		setting.EmailCodeValidMinutes = 120
	}

	return nil
}

func SendWebhookSync(ctx context.Context, cmd *m.SendWebhookSync) error {
	return sendWebRequestSync(ctx, &Webhook{
		Url:        cmd.Url,
		User:       cmd.User,
		Password:   cmd.Password,
		Body:       cmd.Body,
		HttpMethod: cmd.HttpMethod,
		HttpHeader: cmd.HttpHeader,
	})
}

func subjectTemplateFunc(obj map[string]interface{}, value string) string {
	obj["value"] = value
	return ""
}

func sendEmailCommandHandlerSync(ctx context.Context, cmd *m.SendEmailCommandSync) error {
	message, err := buildEmailMessage(&m.SendEmailCommand{
		Data:         cmd.Data,
		Info:         cmd.Info,
		Template:     cmd.Template,
		To:           cmd.To,
		EmbededFiles: cmd.EmbededFiles,
		Subject:      cmd.Subject,
	})

	if err != nil {
		return err
	}

	_, err = send(message)

	return err
}

func sendEmailCommandHandler(cmd *m.SendEmailCommand) error {
	message, err := buildEmailMessage(cmd)

	if err != nil {
		return err
	}

	addToMailQueue(message)

	return nil
}

func sendResetPasswordEmail(cmd *m.SendResetPasswordEmailCommand) error {
	return sendEmailCommandHandler(&m.SendEmailCommand{
		To:       []string{cmd.User.Email},
		Template: tmplResetPassword,
		Data: map[string]interface{}{
			"Code": createUserEmailCode(cmd.User, nil),
			"Name": cmd.User.NameOrFallback(),
		},
	})
}

func validateResetPasswordCode(query *m.ValidateResetPasswordCodeQuery) error {
	login := getLoginForEmailCode(query.Code)
	if login == "" {
		return m.ErrInvalidEmailCode
	}

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: login}
	if err := bus.Dispatch(&userQuery); err != nil {
		return err
	}

	if !validateUserEmailCode(userQuery.Result, query.Code) {
		return m.ErrInvalidEmailCode
	}

	query.Result = userQuery.Result
	return nil
}

func signUpStartedHandler(evt *events.SignUpStarted) error {
	if !setting.VerifyEmailEnabled {
		return nil
	}

	log.Info("User signup started: %s", evt.Email)

	if evt.Email == "" {
		return nil
	}

	err := sendEmailCommandHandler(&m.SendEmailCommand{
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

	emailSentCmd := m.UpdateTempUserWithEmailSentCommand{Code: evt.Code}
	return bus.Dispatch(&emailSentCmd)
}

func signUpCompletedHandler(evt *events.SignUpCompleted) error {
	if evt.Email == "" || !setting.Smtp.SendWelcomeEmailOnSignUp {
		return nil
	}

	return sendEmailCommandHandler(&m.SendEmailCommand{
		To:       []string{evt.Email},
		Template: tmplWelcomeOnSignUp,
		Data: map[string]interface{}{
			"Name": evt.Name,
		},
	})
}
