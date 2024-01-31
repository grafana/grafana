package apiserver

import (
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/spf13/cobra"
	genericapifilters "k8s.io/apiserver/pkg/endpoints/filters"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/util/notfoundhandler"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/component-base/cli"
	"k8s.io/klog/v2"
	aggregatorscheme "k8s.io/kube-aggregator/pkg/apiserver/scheme"

	"github.com/grafana/grafana/pkg/aggregator"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
)

const (
	aggregatorDataPath              = "data"
	defaultAggregatorEtcdPathPrefix = "/registry/grafana.aggregator"
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

func newCommandStartAggregator() *cobra.Command {
	devAcknowledgementNotice := "The aggregator command is in heavy development. The entire setup is subject to change without notice"

	cwd, err := os.Getwd()
	if err != nil {
		panic("could not determine current directory")
	}

	extraConfig := &aggregator.ExtraConfig{
		DataPath: path.Join(cwd, aggregatorDataPath),
	}

	// Register standard k8s flags with the command line
	recommendedOptions := options.NewRecommendedOptions(
		defaultAggregatorEtcdPathPrefix,
		aggregatorscheme.Codecs.LegacyCodec(), // codec is passed to etcd and hence not used
	)

	cmd := &cobra.Command{
		Use:   "aggregator",
		Short: "Run the grafana aggregator",
		Long: "Run a standalone kubernetes based aggregator server. " +
			devAcknowledgementNotice,
		Example: "grafana aggregator",
		RunE: func(c *cobra.Command, args []string) error {
			serverOptions, err := aggregator.NewAggregatorServerOptions(os.Stdout, os.Stderr, recommendedOptions, extraConfig)
			serverOptions.Config.Complete()

			if err != nil {
				klog.Errorf("Could not create aggregator server options: %s", err)
				os.Exit(1)
			}

			return run(serverOptions)
		},
	}

	recommendedOptions.AddFlags(cmd.Flags())
	extraConfig.AddFlags(cmd.Flags())

	return cmd
}

func run(serverOptions *aggregator.AggregatorServerOptions) error {
	if err := serverOptions.LoadAPIGroupBuilders(); err != nil {
		klog.Errorf("Error loading prerequisite APIs: %s", err)
		return err
	}

	notFoundHandler := notfoundhandler.New(serverOptions.Config.SharedConfig.Serializer, genericapifilters.NoMuxAndDiscoveryIncompleteKey)
	apiExtensionsServer, err := serverOptions.Config.ApiExtensionsComplete.New(genericapiserver.NewEmptyDelegateWithCustomHandler(notFoundHandler))
	if err != nil {
		return err
	}

	aggregator, err := serverOptions.CreateAggregatorServer(apiExtensionsServer.GenericAPIServer, apiExtensionsServer.Informers)
	if err != nil {
		klog.Errorf("Error creating aggregator server: %s", err)
		return err
	}

	// Install the API Group+version
	err = grafanaapiserver.InstallAPIs(aggregator.GenericAPIServer, serverOptions.Config.Aggregator.GenericConfig.RESTOptionsGetter, serverOptions.Builders)
	if err != nil {
		klog.Errorf("Error installing apis: %s", err)
		return err
	}

	if err := clientcmd.WriteToFile(
		utils.FormatKubeConfig(aggregator.GenericAPIServer.LoopbackClientConfig),
		path.Join(aggregatorDataPath, "grafana-aggregator", "aggregator.kubeconfig"),
	); err != nil {
		klog.Errorf("Error persisting aggregator.kubeconfig: %s", err)
		return err
	}

	prepared, err := aggregator.PrepareRun()
	if err != nil {
		return err
	}

	stopCh := genericapiserver.SetupSignalHandler()
	if err := prepared.Run(stopCh); err != nil {
		return err
	}
	return nil
}

func RunCobraWrapper() int {
	cmd := newCommandStartAggregator()

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
