package setting

type WebhookSettings struct {
	Enabled    bool
	Url        string
	User       string
	Password   string
	CertFile   string
	KeyFile    string
	SkipVerify bool
}

func (cfg *Cfg) readWebhookSettings() {
	sec := cfg.Raw.Section("webhook")
	cfg.Webhook.Enabled = sec.Key("enabled").MustBool(false)
	cfg.Webhook.Url = sec.Key("url").String()
	cfg.Webhook.User = sec.Key("user").String()
	cfg.Webhook.Password = sec.Key("password").String()
	cfg.Webhook.CertFile = sec.Key("cert_file").String()
	cfg.Webhook.KeyFile = sec.Key("key_file").String()
	cfg.Webhook.SkipVerify = sec.Key("skip_verify").MustBool(false)
}
