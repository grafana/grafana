package setting

import "time"

type SecretsManagerSettings struct {
	IsDeveloperMode      bool
	DeveloperStubLatency time.Duration
}

func (cfg *Cfg) readSecretsManagerSettings() {
	secretsMgmt := cfg.Raw.Section("secrets_manager")
	cfg.SecretsManagement.IsDeveloperMode = secretsMgmt.Key("dev_mode").MustBool(false)
	cfg.SecretsManagement.DeveloperStubLatency = secretsMgmt.Key("dev_stub_latency").MustDuration(0)
}
