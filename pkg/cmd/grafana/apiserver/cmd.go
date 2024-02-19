package apiserver

import (
	"os"

	"github.com/spf13/cobra"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/component-base/cli"

	"github.com/grafana/grafana/pkg/server"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
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
	o.factory.GetOptions().AddFlags(cmd.Flags())

	// Register standard k8s flags with the command line
	o.RecommendedOptions = options.NewRecommendedOptions(
		defaultEtcdPathPrefix,
		grafanaapiserver.Codecs.LegacyCodec(), // the codec is passed to etcd and not used
	)
	o.RecommendedOptions.AddFlags(cmd.Flags())

	return cmd
}

func RunCLI() int {
	stopCh := genericapiserver.SetupSignalHandler()

	options := newAPIServerOptions(os.Stdout, os.Stderr)
	cmd := newCommandStartExampleAPIServer(options, stopCh)

	return cli.Run(cmd)
}
