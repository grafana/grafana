package notifications

import (
	"bytes"
	"errors"
	"fmt"
	"html/template"
	"net/url"
	"path/filepath"

	"github.com/Cepave/grafana/pkg/bus"
	"github.com/Cepave/grafana/pkg/events"
	"github.com/Cepave/grafana/pkg/log"
	m "github.com/Cepave/grafana/pkg/models"
	"github.com/Cepave/grafana/pkg/setting"
	"github.com/Cepave/grafana/pkg/util"
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
	var err error
	var subjectText interface{}

	data := cmd.Data
	if data == nil {
		data = make(map[string]interface{}, 10)
	}

	setDefaultTemplateData(data, nil)
	err = mailTemplates.ExecuteTemplate(&buffer, cmd.Template, data)
	if err != nil {
		return err
	}

	subjectData := data["Subject"].(map[string]interface{})
	subjectText, hasSubject := subjectData["value"]

	if !hasSubject {
		return errors.New(fmt.Sprintf("Missing subject in Template %s", cmd.Template))
	}

	subjectTmpl, err := template.New("subject").Parse(subjectText.(string))
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
<<<<<<< 0cef0587acc57cbcb9e2e4fee102f2afe55f68da

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
=======
>>>>>>> feat(signup): almost done with new sign up flow, #2353

func signUpCompletedHandler(evt *events.SignUpCompleted) error {
	if evt.Email == "" || !setting.Smtp.SendWelcomeEmailOnSignUp {
		return nil
	}

	return sendEmailCommandHandler(&m.SendEmailCommand{
		To:       []string{evt.Email},
		Template: tmplWelcomeOnSignUp,
		Data: map[string]interface{}{
<<<<<<< f9fc891673549432b73c0ddd64d94e418e3665f9
			"Name": evt.Name,
=======
			"Email": evt.Email,
>>>>>>> feat(signup): began work on new / alternate signup flow that includes email verification, #2353
		},
	})
}
