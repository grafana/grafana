package setting

type SmtpSettings struct {
	Enabled     bool
	Host        string
	User        string
	Password    string
	CertFile    string
	KeyFile     string
	FromAddress string
	SkipVerify  bool

	SendWelcomeEmailOnSignUp bool
	TemplatesPattern         string
}

func readSmtpSettings() {
	sec := Cfg.Section("smtp")
	Smtp.Enabled = sec.Key("enabled").MustBool(false)
	Smtp.Host = sec.Key("host").String()
	Smtp.User = sec.Key("user").String()
	Smtp.Password = sec.Key("password").String()
	Smtp.CertFile = sec.Key("cert_file").String()
	Smtp.KeyFile = sec.Key("key_file").String()
	Smtp.FromAddress = sec.Key("from_address").String()
	Smtp.SkipVerify = sec.Key("skip_verify").MustBool(false)

	emails := Cfg.Section("emails")
	Smtp.SendWelcomeEmailOnSignUp = emails.Key("welcome_email_on_sign_up").MustBool(false)
	Smtp.TemplatesPattern = emails.Key("templates_pattern").MustString("emails/*.html")
}
