package setting

const (
	StaticProviderType = "static"
	GOFFProviderType   = "goff"
)

type OpenFeatureSettings struct {
	ProviderType string
	URL          string
	TargetingKey string
	ContextAttrs map[string]any
}

func (cfg *Cfg) readOpenFeatureSettings() {
	cfg.OpenFeature = OpenFeatureSettings{}

	config := cfg.Raw.Section("feature_toggles.openfeature")
	cfg.OpenFeature.ProviderType = config.Key("provider").MustString(StaticProviderType)
	cfg.OpenFeature.URL = config.Key("url").MustString("")
	cfg.OpenFeature.TargetingKey = config.Key("targetingKey").MustString(cfg.AppURL)

	// build the eval context attributes using [feature_toggles.openfeature.context] section
	ctxConf := cfg.Raw.Section("feature_toggles.openfeature.context")
	attrs := map[string]any{}
	for _, key := range ctxConf.KeyStrings() {
		attrs[key] = ctxConf.Key(key).String()
	}

	// Some default attributes
	if _, ok := attrs["grafana_version"]; !ok {
		attrs["grafana_version"] = BuildVersion
	}

	cfg.OpenFeature.ContextAttrs = attrs
}
