package appinstaller

import (
	"github.com/spf13/pflag"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	grafanaapiserveroptions "github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/setting"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

type Options interface {
	AddFlags(fs *pflag.FlagSet)
	ApplyTo(recommendedConfig *genericapiserver.RecommendedConfig, specificConfig any) error
	Validate() []error
}

type SpecificConfigProvider interface {
	GetSpecificConfig() any
}

type OptionsProvider interface {
	GetOptions() Options
	ApplyGrafanaConfig(cfg *setting.Cfg) error
}

type optionsAdapter struct {
	Options
	installer appsdkapiserver.AppInstaller
}

func (o *optionsAdapter) ValidateOptions() []error {
	return o.Options.Validate()
}

func (o *optionsAdapter) ApplyTo(config *genericapiserver.RecommendedConfig) error {
	if specificConfigProvider, ok := o.installer.(SpecificConfigProvider); ok {
		return o.Options.ApplyTo(config, specificConfigProvider.GetSpecificConfig())
	}
	return o.Options.ApplyTo(config, nil)
}

func RegisterOptions(
	opts *grafanaapiserveroptions.Options,
	appInstallers []appsdkapiserver.AppInstaller,
) {
	for _, installer := range appInstallers {
		if optionsProvider, ok := installer.(OptionsProvider); ok {
			opts.APIOptions = append(opts.APIOptions, &optionsAdapter{
				Options:   optionsProvider.GetOptions(),
				installer: installer,
			})
		}
	}
}

func ApplyGrafanaConfig(cfg *setting.Cfg, installers []appsdkapiserver.AppInstaller) error {
	for _, installer := range installers {
		if optionsProvider, ok := installer.(OptionsProvider); ok {
			if err := optionsProvider.ApplyGrafanaConfig(cfg); err != nil {
				return err
			}
		}
	}
	return nil
}
