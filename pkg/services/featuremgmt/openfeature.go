package featuremgmt

import (
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

const (
	staticProviderType = "static"
	goffProviderType   = "goff"

	configSectionName  = "feature_toggles.openfeature"
	contextSectionName = "feature_toggles.openfeature.context"
)

type OpenFeatureService struct {
	provider openfeature.FeatureProvider
	Client   openfeature.IClient
}

func ProvideOpenFeatureService(cfg *setting.Cfg) (*OpenFeatureService, error) {
	conf := cfg.Raw.Section(configSectionName)
	provType := conf.Key("provider").MustString(staticProviderType)
	url := conf.Key("url").MustString("")
	key := conf.Key("targetingKey").MustString(cfg.AppURL)

	var provider openfeature.FeatureProvider
	var err error
	if provType == goffProviderType {
		provider, err = newGOFFProvider(url)
	} else {
		provider, err = newStaticProvider(cfg)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create %s feature provider: %w", provType, err)
	}

	if err := openfeature.SetProviderAndWait(provider); err != nil {
		return nil, fmt.Errorf("failed to set global %s feature provider: %w", provType, err)
	}

	attrs := ctxAttrs(cfg)
	openfeature.SetEvaluationContext(openfeature.NewEvaluationContext(key, attrs))

	client := openfeature.NewClient("grafana-openfeature-client")

	return &OpenFeatureService{
		provider: provider,
		Client:   client,
	}, nil
}

// ctxAttrs uses config.ini [feature_toggles.openfeature.context] section to build the eval context attributes
func ctxAttrs(cfg *setting.Cfg) map[string]any {
	ctxConf := cfg.Raw.Section(contextSectionName)

	attrs := map[string]any{}
	for _, key := range ctxConf.KeyStrings() {
		attrs[key] = ctxConf.Key(key).String()
	}

	// Some default attributes
	if _, ok := attrs["grafana_version"]; !ok {
		attrs["grafana_version"] = setting.BuildVersion
	}

	return attrs
}
