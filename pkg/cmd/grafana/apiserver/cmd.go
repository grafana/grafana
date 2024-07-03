package apiserver

import (
	"context"
	"os"

	"github.com/spf13/cobra"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/component-base/cli"

	"github.com/grafana/grafana/pkg/cmd/grafana-server/commands"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
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
			if err := log.SetupConsoleLogger("debug"); err != nil {
				return nil
			}

			if err := o.Validate(); err != nil {
				return err
			}

			runtime, err := standalone.ReadRuntimeConfig(runtimeConfig)
			if err != nil {
				return err
			}
			apis, err := o.factory.GetEnabled(runtime)
			if err != nil {
				return err
			}

			// Currently TracingOptions.ApplyTo, which will configure/initialize tracing,
			// happens after loadAPIGroupBuilders. Hack to workaround this for now to allow
			// the tracer to be initialized at a later stage, when tracer is available.
			// TODO: Fix so that TracingOptions.ApplyTo happens before or during loadAPIGroupBuilders.
			tracer := newLateInitializedTracingService()

			ctx, cancel := context.WithCancel(c.Context())
			go func() {
				<-stopCh
				cancel()
			}()

			// Load each group from the args
			if err := o.loadAPIGroupBuilders(ctx, tracer, apis); err != nil {
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

			if o.Options.TracingOptions.TracingService != nil {
				tracer.InitTracer(o.Options.TracingOptions.TracingService)
			}

			defer o.factory.Shutdown()

			if err := o.RunAPIServer(config, stopCh); err != nil {
				return err
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&runtimeConfig, "runtime-config", "", "A set of key=value pairs that enable or disable built-in APIs.")

	o.AddFlags(cmd.Flags())

	return cmd
}

func RunCLI(opts commands.ServerOptions) int {
	stopCh := genericapiserver.SetupSignalHandler()

	commands.SetBuildInfo(opts)

	options := newAPIServerOptions(os.Stdout, os.Stderr)
	cmd := newCommandStartExampleAPIServer(options, stopCh)

	return cli.Run(cmd)
}

type lateInitializedTracingService struct {
	tracing.Tracer
}

func newLateInitializedTracingService() *lateInitializedTracingService {
	return &lateInitializedTracingService{
		Tracer: tracing.InitializeTracerForTest(),
	}
}

func (s *lateInitializedTracingService) InitTracer(tracer tracing.Tracer) {
	s.Tracer = tracer
}

var _ tracing.Tracer = &lateInitializedTracingService{}
