package apiserver

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/go-logr/logr"
	"github.com/spf13/cobra"
	"gopkg.in/ini.v1"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/component-base/cli"
	"k8s.io/component-base/logs"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
)

func newCommandStartExampleAPIServer(o *APIServerOptions, stopCh <-chan struct{}) *cobra.Command {
	devAcknowledgementNotice := "The apiserver command is in heavy development. The entire setup is subject to change without notice"
	runtimeConfig := ""

	factory, err := server.InitializeAPIServerFactory()
	if err != nil {
		return nil
	}
	o.factory = factory

	cmd := &cobra.Command{
		Use:   "apiserver [api group(s)]",
		Short: "Run the grafana apiserver",
		Long: "Run a standalone kubernetes based apiserver that can be aggregated by a root apiserver. " +
			devAcknowledgementNotice,
		Example: "grafana apiserver --runtime-config=example.grafana.app/v0alpha1=true",
		RunE: func(c *cobra.Command, args []string) error {
			// Setup logging as the very first thing after we have read the desired verbosity level
			if err := setupLogging(o.ExtraOptions.Verbosity); err != nil {
				return nil
			}

			runtime, err := standalone.ReadRuntimeConfig(runtimeConfig)
			if err != nil {
				return err
			}
			apis, err := o.factory.GetEnabled(runtime)
			if err != nil {
				return err
			}

			// Load each group from the args
			if err := o.loadAPIGroupBuilders(apis); err != nil {
				return err
			}

			// Finish the config (a noop for now)
			if err := o.Complete(); err != nil {
				return err
			}

			config, err := o.Config()
			if err != nil {
				return err
			}

			if err := o.RunAPIServer(config, stopCh); err != nil {
				return err
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&runtimeConfig, "runtime-config", "", "A set of key=value pairs that enable or disable built-in APIs.")

	if factoryOptions := o.factory.GetOptions(); factoryOptions != nil {
		factoryOptions.AddFlags(cmd.Flags())
	}

	o.ExtraOptions.AddFlags(cmd.Flags())

	// Register standard k8s flags with the command line
	o.RecommendedOptions.AddFlags(cmd.Flags())

	return cmd
}

func setupLogging(logLevel int) error {
	iniFile := ini.Empty()
	sLog, err := iniFile.NewSection("log")
	if err != nil {
		fmt.Println(err)
		return nil
	}

	_, err = sLog.NewKey("level", "debug")
	if err != nil {
		fmt.Println(err)
		return nil
	}

	sLogConsole, err := iniFile.NewSection("log.console")
	if err != nil {
		fmt.Println(err)
		return nil
	}

	_, err = sLogConsole.NewKey("format", "console")
	if err != nil {
		fmt.Println(err)
		return nil
	}

	err = log.ReadLoggingConfig([]string{"console"}, "", iniFile)
	if err != nil {
		fmt.Println(err)
		return nil
	}

	logger := logr.New(newLogAdapter(logLevel))
	klog.SetLoggerWithOptions(logger, klog.ContextualLogger(true))
	if _, err := logs.GlogSetter(strconv.Itoa(logLevel)); err != nil {
		logger.Error(err, "failed to set log level")
	}

	return nil
}

func RunCLI() int {
	stopCh := genericapiserver.SetupSignalHandler()

	options := newAPIServerOptions(os.Stdout, os.Stderr)
	cmd := newCommandStartExampleAPIServer(options, stopCh)

	return cli.Run(cmd)
}

var _ logr.LogSink = (*logAdapter)(nil)

type logAdapter struct {
	level int
	log   log.Logger
}

func newLogAdapter(level int) *logAdapter {
	return &logAdapter{log: log.New("grafana-apiserver"), level: level}
}

func (l *logAdapter) WithName(name string) logr.LogSink {
	l.log = l.log.New("name", name)
	return l
}

func (l *logAdapter) WithValues(keysAndValues ...any) logr.LogSink {
	l.log = l.log.New(keysAndValues...)
	return l
}

func (l *logAdapter) Init(_ logr.RuntimeInfo) {
	// we aren't using the logr library for logging, so this is a no-op
}

func (l *logAdapter) Enabled(level int) bool {
	return level <= l.level
}

func (l *logAdapter) Info(level int, msg string, keysAndValues ...any) {
	msg = strings.TrimSpace(msg)
	// kubernetes uses level 0 for critical messages, so map that to Info
	if level == 0 {
		l.log.Info(msg, keysAndValues...)
		return
	}
	// every other level is mapped to Debug
	l.log.Debug(msg, keysAndValues...)
}

func (l *logAdapter) Error(err error, msg string, keysAndValues ...any) {
	msg = strings.TrimSpace(msg)
	l.log.Error(msg, keysAndValues...)
}
