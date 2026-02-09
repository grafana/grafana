package setting

import (
	"fmt"
	"net/url"
)

type OpenFeatureProviderType string

const (
	StaticProviderType          OpenFeatureProviderType = "static"
	FeaturesServiceProviderType OpenFeatureProviderType = "features-service"
	OFREPProviderType           OpenFeatureProviderType = "ofrep"
)

type OpenFeatureSettings struct {
	APIEnabled   bool
	ProviderType OpenFeatureProviderType
	URL          *url.URL
	TargetingKey string
	ContextAttrs map[string]string
}

func (cfg *Cfg) readOpenFeatureSettings() error {
	cfg.OpenFeature = OpenFeatureSettings{}

	config := cfg.Raw.Section("feature_toggles.openfeature")
	cfg.OpenFeature.APIEnabled = config.Key("enable_api").MustBool(true)

	providerType := config.Key("provider").Validate(func(in string) string {
		if in == "" {
			return string(StaticProviderType)
		}

		switch in {
		case string(StaticProviderType):
			return string(StaticProviderType)
		case string(FeaturesServiceProviderType):
			return string(FeaturesServiceProviderType)
		case string(OFREPProviderType):
			return string(OFREPProviderType)
		default:
			cfg.Logger.Warn("invalid provider type", "provider", in)
			cfg.Logger.Info("using static provider for openfeature")
			return string(StaticProviderType)
		}
	})

	cfg.OpenFeature.ProviderType = OpenFeatureProviderType(providerType)
	strURL := config.Key("url").MustString("")

	defaultTargetingKey := "default"
	if cfg.StackID != "" {
		defaultTargetingKey = fmt.Sprintf("stacks-%s", cfg.StackID)
	}

	cfg.OpenFeature.TargetingKey = config.Key("targetingKey").MustString(defaultTargetingKey)

	if strURL != "" && (cfg.OpenFeature.ProviderType == FeaturesServiceProviderType || cfg.OpenFeature.ProviderType == OFREPProviderType) {
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
