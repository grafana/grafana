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
	bus.AddHandler("email", sendResetPasswordEmail)
	bus.AddHandler("email", validateResetPasswordCode)

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

var dispatchMail = func(cmd *m.SendEmailCommand) error {
	return bus.Dispatch(cmd)
}

func subjectTemplateFunc(obj map[string]interface{}, value string) string {
	obj["value"] = value
	return ""
}

func sendResetPasswordEmail(cmd *m.SendResetPasswordEmailCommand) error {
	var buffer bytes.Buffer

	var data = getMailTmplData(cmd.User)
	code := createUserEmailCode(cmd.User, nil)
	data["Code"] = code

	mailTemplates.ExecuteTemplate(&buffer, tmplResetPassword, data)

	dispatchMail(&m.SendEmailCommand{
		To:      []string{cmd.User.Email},
		From:    setting.Smtp.FromAddress,
		Subject: data["Subject"].(map[string]interface{})["value"].(string),
		Body:    buffer.String(),
	})

	return nil
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
