package apiserver

import (
	"os"
	"path"

	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/aggregator"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"

	"github.com/spf13/cobra"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/component-base/cli"
	aggregatorscheme "k8s.io/kube-aggregator/pkg/apiserver/scheme"
)

const (
	aggregatorDataPath              = "data/grafana-aggregator"
	defaultAggregatorEtcdPathPrefix = "/registry/grafana.aggregator"
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
			if err := o.LoadAPIGroupBuilders(args[1:]); err != nil {
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

func newCommandStartAggregator(o *aggregator.AggregatorServerOptions) *cobra.Command {
	devAcknowledgementNotice := "The aggregator command is in heavy development. The entire setup is subject to change without notice"

	cmd := &cobra.Command{
		Use:   "aggregator",
		Short: "Run the grafana aggregator",
		Long: "Run a standalone kubernetes based aggregator server. " +
			devAcknowledgementNotice,
		Example: "grafana aggregator",
		RunE: func(c *cobra.Command, args []string) error {
			return run(o)
		},
	}

	return cmd
}

func run(serverOptions *aggregator.AggregatorServerOptions) error {
	if err := serverOptions.LoadAPIGroupBuilders(); err != nil {
		klog.Errorf("Error loading prerequisite APIs: %s", err)
		return err
	}

	serverOptions.RecommendedOptions.SecureServing.BindPort = 8443
	delegationTarget := genericapiserver.NewEmptyDelegate()

	config, err := serverOptions.CreateAggregatorConfig()
	if err != nil {
		klog.Errorf("Error creating aggregator config: %s", err)
		return err
	}

	aggregator, err := serverOptions.CreateAggregatorServer(config, delegationTarget)
	if err != nil {
		klog.Errorf("Error creating aggregator server: %s", err)
		return err
	}

	// Install the API Group+version
	err = grafanaapiserver.InstallAPIs(aggregator.GenericAPIServer, config.GenericConfig.RESTOptionsGetter, serverOptions.Builders)
	if err != nil {
		klog.Errorf("Error installing apis: %s", err)
		return err
	}

	if err := clientcmd.WriteToFile(
		utils.FormatKubeConfig(aggregator.GenericAPIServer.LoopbackClientConfig),
		path.Join(aggregatorDataPath, "aggregator.kubeconfig"),
	); err != nil {
		klog.Errorf("Error persisting aggregator.kubeconfig: %s", err)
		return err
	}

	// Finish the config (a noop for now)
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
	serverOptions := aggregator.NewAggregatorServerOptions(os.Stdout, os.Stderr)
	// Register standard k8s flags with the command line
	serverOptions.RecommendedOptions = options.NewRecommendedOptions(
		defaultAggregatorEtcdPathPrefix,
		aggregatorscheme.Codecs.LegacyCodec(), // codec is passed to etcd and hence not used
	)

	cmd := newCommandStartAggregator(serverOptions)

	serverOptions.AddFlags(cmd.Flags())

	return cli.Run(cmd)
}
