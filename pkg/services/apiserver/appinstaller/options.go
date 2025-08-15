package appinstaller

import (
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	grafanaapiserveroptions "github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/spf13/pflag"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

type Options interface {
	AddFlags(fs *pflag.FlagSet)
	ApplyTo(config *genericapiserver.RecommendedConfig) error
	Validate() []error
}

type OptionsProvider interface {
	GetOptions() Options
}

type optionsAdapter struct {
	Options
}

func (o *optionsAdapter) ValidateOptions() []error {
	return o.Options.Validate()
}

func RegisterOptions(
	opts *grafanaapiserveroptions.Options,
	appInstallers []appsdkapiserver.AppInstaller,
) {
	for _, installer := range appInstallers {
		if optionsProvider, ok := installer.(OptionsProvider); ok {
			opts.APIOptions = append(opts.APIOptions, &optionsAdapter{Options: optionsProvider.GetOptions()})
		}
	}
}
