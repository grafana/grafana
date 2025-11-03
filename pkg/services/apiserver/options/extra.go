package options

import (
	"log/slog"
	"strconv"

	"github.com/spf13/pflag"
	genericfeatures "k8s.io/apiserver/pkg/features"
	genericapiserver "k8s.io/apiserver/pkg/server"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/component-base/logs"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/slogadapter"
)

type ExtraOptions struct {
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
	return nil
}

func (o *ExtraOptions) ApplyTo(c *genericapiserver.RecommendedConfig) error {
	handler := slogadapter.New(log.New("grafana-apiserver"))
	logger := slog.New(handler)
	if err := utilfeature.DefaultMutableFeatureGate.SetFromMap(map[string]bool{
		string(genericfeatures.WatchList): true,
	}); err != nil {
		return err
	}

	// disabling configured trace provider
	if c.TracerProvider != nil {
		c.TracerProvider = nil
	}

	// if verbosity is 8+, response bodies will be logged. versboity of 7 should then be the max
	if o.Verbosity > 7 {
		o.Verbosity = 7
	}
	klog.SetSlogLogger(logger)
	// at this point, the slog will be the background logger. set it as the default logger, as setting solely slog above
	// won't update the verbosity because it is set as a contextual logger, and that function says "such a logger cannot
	// rely on verbosity checking in klog"
	klog.SetLogger(klog.Background())
	if _, err := logs.GlogSetter(strconv.Itoa(o.Verbosity)); err != nil {
		logger.Error("failed to set log level", "error", err)
	}
	c.ExternalAddress = o.ExternalAddress
	return nil
}
