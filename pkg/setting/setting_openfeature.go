package setting

import (
	"fmt"
	"net/url"
)

const (
	StaticProviderType = "static"
	GOFFProviderType   = "goff"
)

type OpenFeatureSettings struct {
	APIEnabled   bool
	ProviderType string
	URL          *url.URL
	TargetingKey string
	ContextAttrs map[string]any
}

func (cfg *Cfg) readOpenFeatureSettings() error {
	cfg.OpenFeature = OpenFeatureSettings{}

	config := cfg.Raw.Section("feature_toggles.openfeature")
	cfg.OpenFeature.APIEnabled = config.Key("enable_api").MustBool(true)
	cfg.OpenFeature.ProviderType = config.Key("provider").MustString(StaticProviderType)
	cfg.OpenFeature.TargetingKey = config.Key("targetingKey").MustString(cfg.AppURL)

	strURL := config.Key("url").MustString("")

	if strURL != "" && cfg.OpenFeature.ProviderType == GOFFProviderType {
		u, err := url.Parse(strURL)
		if err != nil {
			return fmt.Errorf("invalid feature provider url: %w", err)
		}
		cfg.OpenFeature.URL = u
	}

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
	return nil
}
