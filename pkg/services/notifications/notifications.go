package notifications

import (
	"bytes"
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

	bus.AddHandler("email", sendResetPasswordEmail)
	bus.AddHandler("email", validateResetPasswordCode)
	bus.AddHandler("email", sendEmailCommandHandler)

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
		return errors.New("Invalid email address for smpt from_adress config")
	}

	if setting.EmailCodeValidMinutes == 0 {
		setting.EmailCodeValidMinutes = 120
	}

	return nil
}

func subjectTemplateFunc(obj map[string]interface{}, value string) string {
	obj["value"] = value
	return ""
}

func sendEmailCommandHandler(cmd *m.SendEmailCommand) error {
	if !setting.Smtp.Enabled {
		return errors.New("Grafana mailing/smtp options not configured, contact your Grafana admin")
	}

	var buffer bytes.Buffer
	data := cmd.Data
	if data == nil {
		data = make(map[string]interface{}, 10)
	}

	setDefaultTemplateData(data, nil)
	mailTemplates.ExecuteTemplate(&buffer, cmd.Template, data)

	subjectTmplText := data["Subject"].(map[string]interface{})["value"].(string)
	subjectTmpl, err := template.New("subject").Parse(subjectTmplText)
	if err != nil {
		return err
	}

	var subjectBuffer bytes.Buffer
	err = subjectTmpl.ExecuteTemplate(&subjectBuffer, "subject", data)
	if err != nil {
		return err
	}

	addToMailQueue(&Message{
		To:      cmd.To,
		From:    setting.Smtp.FromAddress,
		Subject: subjectBuffer.String(),
		Body:    buffer.String(),
	})

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

	return sendEmailCommandHandler(&m.SendEmailCommand{
		To:       []string{evt.Email},
		Template: tmplSignUpStarted,
		Data: map[string]interface{}{
			"Email":     evt.Email,
			"Code":      evt.Code,
			"SignUpUrl": setting.ToAbsUrl(fmt.Sprintf("signup/?email=%s&code=%s", url.QueryEscape(evt.Email), url.QueryEscape(evt.Code))),
		},
	})
}

func signUpCompletedHandler(evt *events.SignUpCompleted) error {
	if evt.Email == "" || !setting.Smtp.SendWelcomeEmailOnSignUp {
		return nil
	}

	return sendEmailCommandHandler(&m.SendEmailCommand{
		To:       []string{evt.Email},
		Template: tmplSignUpStarted,
		Data: map[string]interface{}{
			"Name": evt.Name,
		},
	})
}
