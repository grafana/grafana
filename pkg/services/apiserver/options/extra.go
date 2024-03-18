package options

import (
	"log/slog"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/spf13/pflag"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/component-base/logs"
	"k8s.io/klog/v2"
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
	handler := log.NewSLogHandler(log.New("grafana-apiserver"))
	logger := slog.New(handler)

	klog.SetSlogLogger(logger)
	if _, err := logs.GlogSetter(strconv.Itoa(o.Verbosity)); err != nil {
		logger.Error("failed to set log level", "error", err)
	}
	c.ExternalAddress = o.ExternalAddress
	return nil
}
