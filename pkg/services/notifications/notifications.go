package notifications

import (
	"bytes"
	"encoding/hex"
	"errors"
	"html/template"
	"path/filepath"

	"github.com/Unknwon/com"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var mailTemplates *template.Template
var tmplResetPassword = "reset_password.html"

func Init() error {
	bus.AddHandler("email", sendResetPasswordEmail)

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

	var data = getMailTmplData(nil)
	code := CreateUserActiveCode(cmd.User, nil)
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

func CreateUserActiveCode(u *m.User, startInf interface{}) string {
	minutes := setting.EmailCodeValidMinutes
	data := com.ToStr(u.Id) + u.Email + u.Login + u.Password + u.Rands
	code := CreateTimeLimitCode(data, minutes, startInf)

	// add tail hex username
	code += hex.EncodeToString([]byte(u.Login))
	return code
}
