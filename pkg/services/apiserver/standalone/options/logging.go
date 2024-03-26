package options

import (
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/spf13/pflag"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

type LoggingOptions struct {
	logger log.Logger
	Level  string
}

func NewLoggingOptions(logger log.Logger) *LoggingOptions {
	return &LoggingOptions{
		logger: logger,
	}
}

func (o *LoggingOptions) AddFlags(fs *pflag.FlagSet) {
	fs.StringVar(&o.Level, "grafana.log.level", "debug", "Log level, debug, info, warn, error.")
}

func (o *LoggingOptions) Validate() []error {
	return nil
}

func (o *LoggingOptions) ApplyTo(c *genericapiserver.RecommendedConfig) error {
	err := log.SetupConsoleLogger(o.Level)
	if err != nil {
		return err
	}

	o.logger.Info("Starting grafana-apiserver", "version", setting.BuildVersion, "commit", setting.BuildCommit, "branch", setting.BuildBranch, "compiled", time.Unix(setting.BuildStamp, 0))
	o.logger.Debug("Console logging initialized", "logLevel", o.Level)

	return nil
}
