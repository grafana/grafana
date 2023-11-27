package apiserver

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/component-base/cli"
)

func newCommandStartExampleAPIServer(o *ExampleServerOptions, stopCh <-chan struct{}) *cobra.Command {
	// While this exists as an experimental feature, we require adding the scarry looking command line
	devAcknowledgementFlag := "grafana-enable-experimental-apiserver"
	devAcknowledgementNotice := "The apiserver command is in heavy development.  The entire setup is subject to change without notice"

	cmd := &cobra.Command{
		Use:   "apiserver [api group(s)]",
		Short: "Run the grafana apiserver",
		Long: "Run a standalone kubernetes based apiserver that can be aggregated by a root apiserver. " +
			devAcknowledgementNotice,
		Example: fmt.Sprintf("grafana apiserver example.grafana.app --%s", devAcknowledgementFlag),
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			ok, err := cmd.Flags().GetBool(devAcknowledgementFlag)
			if !ok || err != nil {
				fmt.Printf("requires running with the flag: --%s\n\n%s\n\n",
					devAcknowledgementFlag, devAcknowledgementNotice)
				os.Exit(1)
			}
		},
		RunE: func(c *cobra.Command, args []string) error {
			// Load each group from the args
			if err := o.LoadAPIGroupBuilders(args[1:]); err != nil {
				return err
			}

			// Finish the config (applies all defaults)
			if err := o.Complete(); err != nil {
				return err
			}

			config, err := o.Config()
			if err != nil {
				return err
			}

			if err := o.RunExampleServer(config, stopCh); err != nil {
				return err
			}
			return nil
		},
	}

	// Register grafana flags
	cmd.PersistentFlags().Bool(devAcknowledgementFlag, false, devAcknowledgementNotice)

	// Register standard k8s flags with the command line
	o.RecommendedOptions = options.NewRecommendedOptions(
		defaultEtcdPathPrefix,
		Codecs.LegacyCodec(), // the codec is passed to etcd and not used
	)
	o.RecommendedOptions.AddFlags(cmd.Flags())

	return cmd
}

func RunCLI() int {
	stopCh := genericapiserver.SetupSignalHandler()

	options := newExampleServerOptions(os.Stdout, os.Stderr)
	cmd := newCommandStartExampleAPIServer(options, stopCh)

	return cli.Run(cmd)
}
