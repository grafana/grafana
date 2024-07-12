package options

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/spf13/pflag"
	"k8s.io/apimachinery/pkg/runtime"
	genericapiserver "k8s.io/apiserver/pkg/server"
	genericoptions "k8s.io/apiserver/pkg/server/options"
)

type Options struct {
	LoggingOptions     *LoggingOptions
	ExtraOptions       *options.ExtraOptions
	RecommendedOptions *genericoptions.RecommendedOptions
	TracingOptions     *TracingOptions
	MetricsOptions     *MetricsOptions
	ProfilingOptions   *ProfilingOptions
	ServerRunOptions   *genericoptions.ServerRunOptions
	StorageOptions     *options.StorageOptions
}

func New(logger log.Logger, codec runtime.Codec) *Options {
	return &Options{
		LoggingOptions:     NewLoggingOptions(logger),
		ExtraOptions:       options.NewExtraOptions(),
		RecommendedOptions: options.NewRecommendedOptions(codec),
		TracingOptions:     NewTracingOptions(logger),
		MetricsOptions:     NewMetricsOptions(logger),
		ProfilingOptions:   NewProfilingOptions(logger),
		ServerRunOptions:   genericoptions.NewServerRunOptions(),
		StorageOptions:     options.NewStorageOptions(),
	}
}

func (o *Options) AddFlags(fs *pflag.FlagSet) {
	o.LoggingOptions.AddFlags(fs)
	o.ExtraOptions.AddFlags(fs)
	o.RecommendedOptions.AddFlags(fs)
	o.TracingOptions.AddFlags(fs)
	o.MetricsOptions.AddFlags(fs)
	o.ProfilingOptions.AddFlags(fs)
	o.ServerRunOptions.AddUniversalFlags(fs)
}

func (o *Options) Validate() []error {
	if errs := o.LoggingOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if errs := o.ExtraOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if errs := o.TracingOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if errs := o.MetricsOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if errs := o.ProfilingOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if errs := o.ServerRunOptions.Validate(); len(errs) != 0 {
		return errs
	}

	// NOTE: we don't call validate on the top level recommended options as it doesn't like skipping etcd-servers
	// the function is left here for troubleshooting any other config issues
	// errors = append(errors, o.RecommendedOptions.Validate()...)

	if errs := o.RecommendedOptions.SecureServing.Validate(); len(errs) != 0 {
		return errs
	}

	if o.ExtraOptions.DevMode {
		// NOTE: Only consider authn for dev mode - resolves the failure due to missing extension apiserver auth-config
		// in parent k8s
		if errs := o.RecommendedOptions.Authentication.Validate(); len(errs) != 0 {
			return errs
		}
	}

	return nil
}

// A copy of ApplyTo in recommended.go, but for >= 0.28, server pkg in apiserver does a bit extra causing
// a panic when CoreAPI is set to nil
func (o *Options) ModifiedApplyTo(config *genericapiserver.RecommendedConfig) error {
	if err := o.RecommendedOptions.Etcd.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.EgressSelector.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Traces.ApplyTo(config.Config.EgressSelector, &config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.SecureServing.ApplyTo(&config.Config.SecureServing, &config.Config.LoopbackClientConfig); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Authentication.ApplyTo(&config.Config.Authentication, config.SecureServing, config.OpenAPIConfig); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Authorization.ApplyTo(&config.Config.Authorization); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Audit.ApplyTo(&config.Config); err != nil {
		return err
	}

	// TODO: determine whether we need flow control (API priority and fairness)
	// We can't assume that a shared informers config was provided in standalone mode and will need a guard
	// when enabling below
	/* kubeClient, err := kubernetes.NewForConfig(config.ClientConfig)
	if err != nil {
		return err
	}

	if err := o.RecommendedOptions.Features.ApplyTo(&config.Config, kubeClient, config.SharedInformerFactory); err != nil {
		return err
	} */

	if err := o.RecommendedOptions.CoreAPI.ApplyTo(config); err != nil {
		return err
	}

	_, err := o.RecommendedOptions.ExtraAdmissionInitializers(config)
	if err != nil {
		return err
	}

	if err := o.ServerRunOptions.ApplyTo(&config.Config); err != nil {
		return err
	}

	return nil
}

func (o *Options) ApplyTo(serverConfig *genericapiserver.RecommendedConfig) error {
	if o.LoggingOptions != nil {
		if err := o.LoggingOptions.ApplyTo(serverConfig); err != nil {
			return err
		}
	}

	if o.ExtraOptions != nil {
		if err := o.ExtraOptions.ApplyTo(serverConfig); err != nil {
			return err
		}
	}

	if o.RecommendedOptions.CoreAPI == nil {
		if err := o.ModifiedApplyTo(serverConfig); err != nil {
			return err
		}
	} else {
		if err := o.RecommendedOptions.ApplyTo(serverConfig); err != nil {
			return err
		}
	}

	if o.TracingOptions != nil {
		if err := o.TracingOptions.ApplyTo(serverConfig); err != nil {
			return err
		}
	}

	if o.MetricsOptions != nil {
		if err := o.MetricsOptions.ApplyTo(serverConfig); err != nil {
			return err
		}
	}

	if o.ProfilingOptions != nil {
		if err := o.ProfilingOptions.ApplyTo(serverConfig); err != nil {
			return err
		}
	}

	if o.ServerRunOptions != nil {
		if err := o.ServerRunOptions.ApplyTo(&serverConfig.Config); err != nil {
			return err
		}
	}

	return nil
}
