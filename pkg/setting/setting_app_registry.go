package setting

type AppRegistrySettings struct {
	KubernetesAnnotationsAppEnabled bool
}

func (cfg *Cfg) readAppPlatformSection() {
	settings := AppRegistrySettings{}

	appPlatformSection := cfg.Raw.Section("app_registry")
	settings.KubernetesAnnotationsAppEnabled = appPlatformSection.Key("annotations_app_enabled").MustBool(false)

	cfg.AppRegistry = settings
}
