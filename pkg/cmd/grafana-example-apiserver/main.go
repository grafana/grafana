package main

import (
	"os"

	"github.com/spf13/cobra"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/component-base/cli"
)

func NewCommandStartExampleAPIServer(defaults *ExampleServerOptions, stopCh <-chan struct{}) *cobra.Command {
	o := *defaults
	cmd := &cobra.Command{
		Short: "Launch the example API server",
		Long:  "Launch the example API server",
		RunE: func(c *cobra.Command, args []string) error {
			if err := o.Complete(); err != nil {
				return err
			}

			if err := o.Validate(args); err != nil {
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

func main() {
	stopCh := genericapiserver.SetupSignalHandler()
	options, err := NewExampleServerOptions(os.Stdout, os.Stderr)
	if err != nil {
		panic(err)
	}

	cmd := NewCommandStartExampleAPIServer(options, stopCh)

	code := cli.Run(cmd)
	os.Exit(code)
}
