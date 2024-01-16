package options

import (
	"k8s.io/apimachinery/pkg/runtime"
	genericoptions "k8s.io/apiserver/pkg/server/options"

	"github.com/spf13/pflag"
)

const defaultEtcdPathPrefix = "/registry/grafana.app"

type Options struct {
	RecommendedOptions *genericoptions.RecommendedOptions
	AggregatorOptions  *AggregatorServerOptions
}

func NewOptions(codec runtime.Codec) *Options {
	return &Options{
		RecommendedOptions: genericoptions.NewRecommendedOptions(
			defaultEtcdPathPrefix,
			codec,
		),
		AggregatorOptions: NewAggregatorServerOptions(),
	}
}

func (o *Options) AddFlags(fs *pflag.FlagSet) {
	o.RecommendedOptions.AddFlags(fs)
	o.AggregatorOptions.AddFlags(fs)
}

func (o *Options) Validate() []error {
	if errs := o.RecommendedOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if errs := o.AggregatorOptions.Validate(); len(errs) != 0 {
		return errs
	}

	return nil
}
