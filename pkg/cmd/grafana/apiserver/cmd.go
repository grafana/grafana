package apiserver

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/component-base/cli"

	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
)

func newCommandStartExampleAPIServer(o *APIServerOptions, stopCh <-chan struct{}) *cobra.Command {
	devAcknowledgementNotice := "The apiserver command is in heavy development. The entire setup is subject to change without notice"
	runtimeConfig := ""

	cmd := &cobra.Command{
		Use:   "apiserver [api group(s)]",
		Short: "Run the grafana apiserver",
		Long: "Run a standalone kubernetes based apiserver that can be aggregated by a root apiserver. " +
			devAcknowledgementNotice,
		Example: "grafana apiserver example.grafana.app",
		RunE: func(c *cobra.Command, args []string) error {
			apis, err := readRuntimeConfig(runtimeConfig)
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

type apiConfig struct {
	group   string
	version string
	enabled bool
}

func (a apiConfig) String() string {
	return fmt.Sprintf("%s/%s=%v", a.group, a.version, a.enabled)
}

// Supported options are:
//
//	<group>/<version>=true|false for a specific API group and version (e.g. dashboards.grafana.app/v0alpha1=true)
//	api/all=true|false controls all API versions
//	api/ga=true|false controls all API versions of the form v[0-9]+
//	api/beta=true|false controls all API versions of the form v[0-9]+beta[0-9]+
//	api/alpha=true|false controls all API versions of the form v[0-9]+alpha[0-9]+`)
//
// See: https://kubernetes.io/docs/reference/command-line-tools-reference/kube-apiserver/
func readRuntimeConfig(cfg string) ([]apiConfig, error) {
	if cfg == "" {
		return nil, fmt.Errorf("missing --runtime-config={apiservers}")
	}
	parts := strings.Split(cfg, ",")
	apis := make([]apiConfig, len(parts))
	for i, part := range parts {
		idx0 := strings.Index(part, "/")
		idx1 := strings.LastIndex(part, "=")
		if idx1 < idx0 || idx0 < 0 {
			return nil, fmt.Errorf("expected values in the form: group/version=true")
		}
		apis[i] = apiConfig{
			group:   part[:idx0],
			version: part[idx0+1 : idx1],
			enabled: part[idx1+1:] == "true",
		}
	}
	return apis, nil
}
