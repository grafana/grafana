package setting

import (
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/util"
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
	StaticHeaders  map[string]string
	EnableTracing  bool

	SendWelcomeEmailOnSignUp bool
	TemplatesPatterns        []string
	ContentTypes             []string
}

// validates mail headers
var mailHeaderRegex = regexp.MustCompile(`^[A-Z][A-Za-z0-9]*(-[A-Z][A-Za-z0-9]*)*$`)

func (cfg *Cfg) readSmtpSettings() error {
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
	if cfg.Smtp.EhloIdentity == "" {
		cfg.Smtp.EhloIdentity = cfg.InstanceName
	}
	cfg.Smtp.StartTLSPolicy = sec.Key("startTLS_policy").String()
	cfg.Smtp.SkipVerify = sec.Key("skip_verify").MustBool(false)

	emails := cfg.Raw.Section("emails")
	cfg.Smtp.SendWelcomeEmailOnSignUp = emails.Key("welcome_email_on_sign_up").MustBool(false)
	cfg.Smtp.TemplatesPatterns = util.SplitString(emails.Key("templates_pattern").MustString("emails/*.html, emails/*.txt"))
	cfg.Smtp.ContentTypes = util.SplitString(emails.Key("content_types").MustString("text/html"))

	// populate static headers
	if err := cfg.readGrafanaSmtpStaticHeaders(); err != nil {
		return err
	}

	cfg.Smtp.EnableTracing = sec.Key("enable_tracing").MustBool(false)

	return nil
}

func validHeader(header string) bool {
	return mailHeaderRegex.MatchString(header)
}

func (cfg *Cfg) readGrafanaSmtpStaticHeaders() error {
	staticHeadersSection := cfg.Raw.Section("smtp.static_headers")
	keys := staticHeadersSection.Keys()
	cfg.Smtp.StaticHeaders = make(map[string]string, len(keys))

	for _, key := range keys {
		if !validHeader(key.Name()) {
			return fmt.Errorf("header %q in [smtp.static_headers] configuration: must follow canonical MIME form", key.Name())
		}

		cfg.Smtp.StaticHeaders[key.Name()] = key.Value()
	}

	return nil
}
