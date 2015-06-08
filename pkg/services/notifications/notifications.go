package notifications

import (
	"bytes"
	"errors"
	"html/template"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var mailTemplates *template.Template
var tmplResetPassword = "reset_password.html"

func Init() error {
	initMailQueue()

	bus.AddHandler("email", sendResetPasswordEmail)
	bus.AddHandler("email", validateResetPasswordCode)
	bus.AddHandler("email", sendEmailCommandHandler)

	mailTemplates = template.New("name")
	mailTemplates.Funcs(template.FuncMap{
		"Subject": subjectTemplateFunc,
	})

	templatePattern := filepath.Join(setting.StaticRootPath, "emails/*.html")
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
	var buffer bytes.Buffer
	data := cmd.Data
	if data == nil {
		data = make(map[string]interface{}, 10)
	}

	setDefaultTemplateData(data, nil)
	mailTemplates.ExecuteTemplate(&buffer, cmd.Template, data)

	addToMailQueue(&Message{
		To:      cmd.To,
		From:    setting.Smtp.FromAddress,
		Subject: data["Subject"].(map[string]interface{})["value"].(string),
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
