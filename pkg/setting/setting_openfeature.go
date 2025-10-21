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
	ContextAttrs map[string]string
}

func (cfg *Cfg) readOpenFeatureSettings() error {
	cfg.OpenFeature = OpenFeatureSettings{}

	config := cfg.Raw.Section("feature_toggles.openfeature")
	cfg.OpenFeature.APIEnabled = config.Key("enable_api").MustBool(true)
	cfg.OpenFeature.ProviderType = config.Key("provider").MustString(StaticProviderType)
	strURL := config.Key("url").MustString("")

	defaultTargetingKey := "default"
	if cfg.StackID != "" {
		defaultTargetingKey = fmt.Sprintf("stacks-%s", cfg.StackID)
	}

	cfg.OpenFeature.TargetingKey = config.Key("targetingKey").MustString(defaultTargetingKey)

	if strURL != "" && cfg.OpenFeature.ProviderType == GOFFProviderType {
		u, err := url.Parse(strURL)
		if err != nil {
			return fmt.Errorf("invalid feature provider url: %w", err)
		}
		cfg.OpenFeature.URL = u
	}

	// build the eval context attributes using [feature_toggles.openfeature.context] section
	ctxConf := cfg.Raw.Section("feature_toggles.openfeature.context")
	attrs := map[string]string{}
	for _, key := range ctxConf.KeyStrings() {
		attrs[key] = ctxConf.Key(key).String()
	}

	// Some default attributes
	if _, ok := attrs["grafana_version"]; !ok {
		attrs["grafana_version"] = BuildVersion
	}

	if _, ok := attrs["namespace"]; !ok {
		attrs["namespace"] = defaultTargetingKey
	}

	cfg.OpenFeature.ContextAttrs = attrs
	return nil
}
