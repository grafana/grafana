package apiserver

import (
	"os"
	"path"

	"github.com/grafana/grafana/pkg/aggregator"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"

	"github.com/spf13/cobra"
	"k8s.io/apimachinery/pkg/runtime"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/component-base/cli"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"
	aggregatorscheme "k8s.io/kube-aggregator/pkg/apiserver/scheme"
	aggregatoropenapi "k8s.io/kube-aggregator/pkg/generated/openapi"
)

const (
	defaultAggregatorEtcdPathPrefix = "/registry/grafana.aggregator"
)

func newCommandStartExampleAPIServer(o *APIServerOptions, stopCh <-chan struct{}) *cobra.Command {
	devAcknowledgementNotice := "The apiserver command is in heavy development.  The entire setup is subject to change without notice"

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
		Codecs.LegacyCodec(), // the codec is passed to etcd and not used
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

func newCommandStartAggregator(aggregator *aggregatorapiserver.APIAggregator, stopCh <-chan struct{}) *cobra.Command {
	devAcknowledgementNotice := "The apiserver command is in heavy development.  The entire setup is subject to change without notice"

	cmd := &cobra.Command{
		Use:   "aggregator",
		Short: "Run the grafana apiserver",
		Long: "Run a standalone kubernetes based aggregator server. " +
			devAcknowledgementNotice,
		Example: "grafana aggregator",
		RunE: func(c *cobra.Command, args []string) error {
			// Finish the config (a noop for now)
			prepared, err := aggregator.PrepareRun()
			if err != nil {
				return err
			}

			if err := prepared.Run(stopCh); err != nil {
				return err
			}
			return nil
		},
	}

	return cmd
}

func RunAggregatorCLI() int {
	// time.Sleep(10 * time.Second)
	delegationTarget := genericapiserver.NewEmptyDelegate()

	serverOptions := aggregator.NewAggregatorServerOptions(os.Stdout, os.Stderr)
	// Register standard k8s flags with the command line
	serverOptions.RecommendedOptions = options.NewRecommendedOptions(
		defaultAggregatorEtcdPathPrefix,
		aggregatorscheme.Codecs.LegacyCodec(), // codec is passed to etcd and hence not used
	)

	sharedConfig, err := serverOptions.Config(aggregatorscheme.Codecs)
	if err != nil {
		klog.Errorf("Error translating server options to config: %s", err)
		return -1
	}

	config, err := aggregator.CreateAggregatorConfig(sharedConfig.Config,
		*serverOptions.RecommendedOptions,
		[]*runtime.Scheme{aggregatorscheme.Scheme},
		aggregatoropenapi.GetOpenAPIDefinitions)
	if err != nil {
		klog.Errorf("Error creating aggregator config: %s", err)
		return -1
	}

	aggregator, err := aggregator.CreateAggregatorServer(*config, delegationTarget)
	if err != nil {
		klog.Errorf("Error creating aggregator server: %s", err)
		return -1
	}

	stopCh := genericapiserver.SetupSignalHandler()
	cmd := newCommandStartAggregator(aggregator, stopCh)
	serverOptions.RecommendedOptions.AddFlags(cmd.Flags())

	if err = clientcmd.WriteToFile(
		utils.FormatKubeConfig(aggregator.GenericAPIServer.LoopbackClientConfig),
		path.Join(dataPath, "grafana.kubeconfig"),
	); err != nil {
		klog.Errorf("Error persisting grafana.kubeconfig: %s", err)
		return -1
	}

	return cli.Run(cmd)
}
