package apiserver

import (
	"os"

	"github.com/spf13/cobra"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/component-base/cli"

	"github.com/grafana/grafana/pkg/registry/apis/example"
	grafanaAPIServer "github.com/grafana/grafana/pkg/services/grafana-apiserver"
)

func newCommandStartExampleAPIServer(defaults *ExampleServerOptions, stopCh <-chan struct{}) *cobra.Command {
	o := *defaults
	cmd := &cobra.Command{
		Short: "Launch the example API server",
		Long:  "Launch the example API server",
		RunE: func(c *cobra.Command, args []string) error {
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

	flags := cmd.Flags()
	o.RecommendedOptions.AddFlags(flags)

	return cmd
}

func RunMain() int {
	stopCh := genericapiserver.SetupSignalHandler()

	// Load the API services
	builders := []grafanaAPIServer.APIGroupBuilder{
		&example.TestingAPIBuilder{}, // hardcoded example apiserver (for now)
	}

	// Configure the server
	options, err := NewExampleServerOptions(builders, os.Stdout, os.Stderr)
	if err != nil {
		panic(err)
	}

	cmd := newCommandStartExampleAPIServer(options, stopCh)

	return cli.Run(cmd)
}
