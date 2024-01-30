package apiserver

import (
	"os"

	"github.com/spf13/cobra"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/component-base/cli"

	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
)

func newCommandStartExampleAPIServer(o *APIServerOptions, stopCh <-chan struct{}) *cobra.Command {
	devAcknowledgementNotice := "The apiserver command is in heavy development. The entire setup is subject to change without notice"

	cmd := &cobra.Command{
		Use:   "apiserver [api group(s)]",
		Short: "Run the grafana apiserver",
		Long: "Run a standalone kubernetes based apiserver that can be aggregated by a root apiserver. " +
			devAcknowledgementNotice,
		Example: "grafana apiserver example.grafana.app",
		RunE: func(c *cobra.Command, args []string) error {
			// Load each group from the args
			if err := o.loadAPIGroupBuilders(args[1:]); err != nil {
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
