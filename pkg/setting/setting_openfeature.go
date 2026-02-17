package setting

import (
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/features"
)

// OpenFeatureProviderType is an alias for features.OpenFeatureProviderType
type OpenFeatureProviderType = features.OpenFeatureProviderType

const (
	// StaticProviderType is for internal Grafana use with static flags
	StaticProviderType OpenFeatureProviderType = "static"

	// Re-export features package constants for convenience
	FeaturesServiceProviderType = features.FeaturesServiceProviderType
	OFREPProviderType           = features.OFREPProviderType
)

type OpenFeatureSettings struct {
	APIEnabled   bool
	ProviderType features.OpenFeatureProviderType
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
		case string(features.FeaturesServiceProviderType):
			return string(features.FeaturesServiceProviderType)
		case string(features.OFREPProviderType):
			return string(features.OFREPProviderType)
		default:
			cfg.Logger.Warn("invalid provider type", "provider", in)
			cfg.Logger.Info("using static provider for openfeature")
			return string(StaticProviderType)
		}
	})

	cfg.OpenFeature.ProviderType = features.OpenFeatureProviderType(providerType)
	strURL := config.Key("url").MustString("")

	defaultTargetingKey := "default"
	if cfg.StackID != "" {
		defaultTargetingKey = fmt.Sprintf("stacks-%s", cfg.StackID)
	}

	cfg.OpenFeature.TargetingKey = config.Key("targetingKey").MustString(defaultTargetingKey)

	if strURL != "" && (cfg.OpenFeature.ProviderType == features.FeaturesServiceProviderType || cfg.OpenFeature.ProviderType == features.OFREPProviderType) {
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
