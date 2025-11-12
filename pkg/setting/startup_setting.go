package setting

type StartupSettings struct {
	KubernetesAnnotationsAppEnabled bool
}

func (cfg *Cfg) readStartupSettingsSection() {
	settings := StartupSettings{}

	startupSettingsSection := cfg.Raw.Section("startup_settings")
	settings.KubernetesAnnotationsAppEnabled = startupSettingsSection.Key("annotations_app_enabled").MustBool(false)

	cfg.StartupSettings = settings
}
