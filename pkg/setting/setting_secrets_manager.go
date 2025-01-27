package setting

type SecretsManagerSettings struct {
	IsDeveloperMode bool
}

func (cfg *Cfg) readSecretsManagerSettings() {
	secretsMgmt := cfg.Raw.Section("secrets_manager")
	cfg.SecretsManagement.IsDeveloperMode = secretsMgmt.Key("dev_mode").MustBool(false)
}
