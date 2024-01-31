package options

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
	genericapiserver "k8s.io/apiserver/pkg/server"
	genericoptions "k8s.io/apiserver/pkg/server/options"

	"github.com/spf13/pflag"
)

const defaultEtcdPathPrefix = "/registry/grafana.app"

type Options struct {
	RecommendedOptions *genericoptions.RecommendedOptions
	AggregatorOptions  *AggregatorServerOptions
	StorageOptions     *StorageOptions
	ExtraOptions       *ExtraOptions
}

func NewOptions(codec runtime.Codec) *Options {
	return &Options{
		RecommendedOptions: genericoptions.NewRecommendedOptions(
			defaultEtcdPathPrefix,
			codec,
		),
		AggregatorOptions: NewAggregatorServerOptions(),
		StorageOptions:    NewStorageOptions(),
		ExtraOptions:      NewExtraOptions(),
	}
}

func (o *Options) AddFlags(fs *pflag.FlagSet) {
	o.RecommendedOptions.AddFlags(fs)
	o.AggregatorOptions.AddFlags(fs)
	o.StorageOptions.AddFlags(fs)
	o.ExtraOptions.AddFlags(fs)
}

func (o *Options) Validate() []error {
	if errs := o.ExtraOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if errs := o.StorageOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if errs := o.AggregatorOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if o.ExtraOptions.DevMode {
		if errs := o.RecommendedOptions.SecureServing.Validate(); len(errs) != 0 {
			return errs
		}

		if errs := o.RecommendedOptions.Authentication.Validate(); len(errs) != 0 {
			return errs
		}
	}

	if o.StorageOptions.StorageType == StorageTypeEtcd {
		if errs := o.RecommendedOptions.Etcd.Validate(); len(errs) != 0 {
			return errs
		}
	}

	return nil
}

func (o *Options) ApplyTo(serverConfig *genericapiserver.RecommendedConfig) error {
	serverConfig.AggregatedDiscoveryGroupManager = aggregated.NewResourceManager("apis")

	if err := o.RecommendedOptions.SecureServing.ApplyTo(&serverConfig.SecureServing, &serverConfig.LoopbackClientConfig); err != nil {
		return err
	}

	if err := o.RecommendedOptions.Authentication.ApplyTo(&serverConfig.Authentication, serverConfig.SecureServing, serverConfig.OpenAPIConfig); err != nil {
		return err
	}

	if err := o.ExtraOptions.ApplyTo(serverConfig); err != nil {
		return err
	}

	return nil
}
