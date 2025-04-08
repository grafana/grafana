package options

import (
	"log/slog"
	"strconv"

	"github.com/spf13/pflag"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	genericfeatures "k8s.io/apiserver/pkg/features"
	genericapiserver "k8s.io/apiserver/pkg/server"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/component-base/logs"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/slogadapter"
	"k8s.io/apiserver/pkg/server/options"
)

type ExtraOptions struct {
	*options.RecommendedOptions
	ExtraRunners    []ExtraRunner
	GroupVersions   []schema.GroupVersion
	CodecFactory    serializer.CodecFactory
	DevMode         bool
	ExternalAddress string
	APIURL          string
	Verbosity       int
}

func NewExtraOptions() *ExtraOptions {
	return &ExtraOptions{
		DevMode:   false,
		Verbosity: 0,
	}
}

func (o *ExtraOptions) AddFlags(fs *pflag.FlagSet) {
	fs.BoolVar(&o.DevMode, "grafana-apiserver-dev-mode", o.DevMode, "Enable dev mode")
	fs.StringVar(&o.ExternalAddress, "grafana-apiserver-host", o.ExternalAddress, "Host")
	fs.StringVar(&o.APIURL, "grafana-apiserver-api-url", o.APIURL, "API URL")
	fs.IntVar(&o.Verbosity, "verbosity", o.Verbosity, "Verbosity")
}

func (o *ExtraOptions) Validate() []error {
	if o == nil {
		return nil
	}

	errs := []error{}
	errs = append(errs, o.RecommendedOptions.Validate()...)
	return errs
}

func (o *ExtraOptions) ApplyTo(config *genericapiserver.RecommendedConfig) error {
	if o == nil {
		return nil
	}

	if err := o.RecommendedOptions.ApplyTo(config); err != nil {
		return err
	}

	handler := slogadapter.New(log.New("grafana-apiserver"))
	logger := slog.New(handler)
	if err := utilfeature.DefaultMutableFeatureGate.SetFromMap(map[string]bool{
		string(genericfeatures.APIServerTracing): false,
	}); err != nil {
		return err
	}
	// TODO: klog isn't working as expected, investigate - it logs some of the time
	klog.SetSlogLogger(logger)
	if _, err := logs.GlogSetter(strconv.Itoa(o.Verbosity)); err != nil {
		logger.Error("failed to set log level", "error", err)
	}
	config.ExternalAddress = o.ExternalAddress
	return nil
}
