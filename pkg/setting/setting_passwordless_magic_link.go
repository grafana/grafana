package setting

import "time"

type AuthPasswordlessMagicLinkSettings struct {
	// Passwordless Auth via Magic Link
	Enabled        bool
	CodeExpiration time.Duration
}

func (cfg *Cfg) readPasswordlessMagicLinkSettings() {
	authPasswordless := cfg.SectionWithEnvOverrides("auth.passwordless")
	PasswordlessMagicLinkSettings := AuthPasswordlessMagicLinkSettings{}
	PasswordlessMagicLinkSettings.Enabled = authPasswordless.Key("enabled").MustBool(false)
	PasswordlessMagicLinkSettings.CodeExpiration = authPasswordless.Key("code_expiration").MustDuration(time.Minute * 20)
	cfg.PasswordlessMagicLinkAuth = PasswordlessMagicLinkSettings
}
