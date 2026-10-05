package setting

import (
	"fmt"
	"regexp"

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
	StaticHeaders  map[string]string
	EnableTracing  bool

	SendWelcomeEmailOnSignUp bool
	TemplatesPatterns        []string
	ContentTypes             []string
}

// validates mail headers
var mailHeaderRegex = regexp.MustCompile(`^[A-Z][A-Za-z0-9]*(-[A-Z][A-Za-z0-9]*)*$`)

func (cfg *Cfg) readSmtpSettings() error {
	smtpSetts, err := ReadSmtpSettings(cfg.Raw, cfg.InstanceName)
	if err != nil {
		return err
	}
	cfg.Smtp = smtpSetts
	return nil
}

func ReadSmtpSettings(iniFile *ini.File, instanceName string) (SmtpSettings, error) {
	smtpSection := iniFile.Section("smtp")
	staticHeadersSection := iniFile.Section("smtp.static_headers")
	emails := iniFile.Section("emails")

	smtpSetts := SmtpSettings{}

	smtpSetts.Enabled = smtpSection.Key("enabled").MustBool(false)
	smtpSetts.Host = smtpSection.Key("host").String()
	smtpSetts.User = smtpSection.Key("user").String()
	smtpSetts.Password = smtpSection.Key("password").String()
	smtpSetts.CertFile = smtpSection.Key("cert_file").String()
	smtpSetts.KeyFile = smtpSection.Key("key_file").String()
	smtpSetts.FromAddress = smtpSection.Key("from_address").String()
	smtpSetts.FromName = smtpSection.Key("from_name").String()
	smtpSetts.EhloIdentity = smtpSection.Key("ehlo_identity").String()
	if smtpSetts.EhloIdentity == "" {
		smtpSetts.EhloIdentity = instanceName
	}
	smtpSetts.StartTLSPolicy = smtpSection.Key("startTLS_policy").String()
	smtpSetts.SkipVerify = smtpSection.Key("skip_verify").MustBool(false)

	smtpSetts.SendWelcomeEmailOnSignUp = emails.Key("welcome_email_on_sign_up").MustBool(false)
	smtpSetts.TemplatesPatterns = util.SplitString(emails.Key("templates_pattern").MustString("emails/*.html, emails/*.txt"))
	smtpSetts.ContentTypes = util.SplitString(emails.Key("content_types").MustString("text/html"))

	// populate static headers
	staticHeaders, err := readGrafanaSmtpStaticHeaders(staticHeadersSection)
	if err != nil {
		return SmtpSettings{}, err
	}
	smtpSetts.StaticHeaders = staticHeaders
	smtpSetts.EnableTracing = smtpSection.Key("enable_tracing").MustBool(false)
	return smtpSetts, nil
}

func validHeader(header string) bool {
	return mailHeaderRegex.MatchString(header)
}

func readGrafanaSmtpStaticHeaders(staticHeadersSection *ini.Section) (map[string]string, error) {
	keys := staticHeadersSection.Keys()
	staticHeaders := make(map[string]string, len(keys))
	for _, key := range keys {
		if !validHeader(key.Name()) {
			return nil, fmt.Errorf("header %q in [smtp.static_headers] configuration: must follow canonical MIME form", key.Name())
		}
		staticHeaders[key.Name()] = key.Value()
	}

	return staticHeaders, nil
}
