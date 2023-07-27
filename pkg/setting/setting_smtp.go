package setting

import (
	"github.com/grafana/grafana/pkg/util"
	"gopkg.in/ini.v1"
)

type SmtpSettings struct {
	Enabled        bool
	Host           string
	User           string
	Password       string
	CertFile       string
	KeyFile        string
	FromAddress    string
	FromName       string
	EhloIdentity   string
	StartTLSPolicy string
	SkipVerify     bool

	SendWelcomeEmailOnSignUp bool
	TemplatesPatterns        []string
	ContentTypes             []string
	Theme                    string
}

const (
	darkTheme  = "dark"
	lightTheme = "light"
)

func (cfg *Cfg) readSmtpSettings() {
	sec := cfg.Raw.Section("smtp")
	cfg.Smtp.Enabled = sec.Key("enabled").MustBool(false)
	cfg.Smtp.Host = sec.Key("host").String()
	cfg.Smtp.User = sec.Key("user").String()
	cfg.Smtp.Password = sec.Key("password").String()
	cfg.Smtp.CertFile = sec.Key("cert_file").String()
	cfg.Smtp.KeyFile = sec.Key("key_file").String()
	cfg.Smtp.FromAddress = sec.Key("from_address").String()
	cfg.Smtp.FromName = sec.Key("from_name").String()
	cfg.Smtp.EhloIdentity = sec.Key("ehlo_identity").String()
	cfg.Smtp.StartTLSPolicy = sec.Key("startTLS_policy").String()
	cfg.Smtp.SkipVerify = sec.Key("skip_verify").MustBool(false)

	emails := cfg.Raw.Section("emails")
	cfg.Smtp.SendWelcomeEmailOnSignUp = emails.Key("welcome_email_on_sign_up").MustBool(false)
	cfg.Smtp.TemplatesPatterns = util.SplitString(emails.Key("templates_pattern").MustString("emails/*.html, emails/*.txt"))
	cfg.Smtp.ContentTypes = util.SplitString(emails.Key("content_types").MustString("text/html"))
	cfg.Smtp.Theme = emailTheme(emails)
}

func emailTheme(emails *ini.Section) string {
	emailTheme := emails.Key("theme").MustString(darkTheme)
	if emailTheme != darkTheme && emailTheme != lightTheme {
		return darkTheme
	}
	return emailTheme
}
