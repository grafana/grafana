package apiserver

import (
	"context"
	"fmt"
	"io"
	"net"
	"path"

	"github.com/grafana/pyroscope-go/godeltaprof/http/pprof"
	"github.com/spf13/pflag"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilerrors "k8s.io/apimachinery/pkg/util/errors"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/mux"
	"k8s.io/client-go/tools/clientcmd"
	netutils "k8s.io/utils/net"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	grafanaAPIServer "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	standaloneoptions "github.com/grafana/grafana/pkg/services/apiserver/standalone/options"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	dataPath = "data/grafana-apiserver" // same as grafana core
)

// APIServerOptions contains the state for the apiserver
type APIServerOptions struct {
	factory      standalone.APIServerFactory
	builders     []builder.APIGroupBuilder
	Options      *standaloneoptions.Options
	AlternateDNS []string
	logger       log.Logger

	StdOut io.Writer
	StdErr io.Writer
}

func newAPIServerOptions(out, errOut io.Writer) *APIServerOptions {
	logger := log.New("grafana-apiserver")

	return &APIServerOptions{
		logger:  logger,
		StdOut:  out,
		StdErr:  errOut,
		Options: standaloneoptions.New(logger, grafanaAPIServer.Codecs.LegacyCodec()),
	}
}

func (o *APIServerOptions) loadAPIGroupBuilders(ctx context.Context, tracer tracing.Tracer, apis []schema.GroupVersion) error {
	o.builders = []builder.APIGroupBuilder{}
	for _, gv := range apis {
		api, err := o.factory.MakeAPIServer(ctx, tracer, gv)
		if err != nil {
			return err
		}
		o.builders = append(o.builders, api)
	}

	if len(o.builders) < 1 {
		return fmt.Errorf("no apis matched ")
	}

	// Install schemas
	for _, b := range o.builders {
		if err := b.InstallSchema(grafanaAPIServer.Scheme); err != nil {
			return err
		}
	}
	return nil
}

func (o *APIServerOptions) Config(tracer tracing.Tracer) (*genericapiserver.RecommendedConfig, error) {
	if err := o.Options.RecommendedOptions.SecureServing.MaybeDefaultWithSelfSignedCerts(
		"localhost", o.AlternateDNS, []net.IP{netutils.ParseIPSloppy("127.0.0.1")},
	); err != nil {
		return nil, fmt.Errorf("error creating self-signed certificates: %v", err)
	}

	o.Options.RecommendedOptions.Authentication.RemoteKubeConfigFileOptional = true

	// TODO: determine authorization, currently insecure because Authorization provided by recommended options doesn't work
	// reason: an aggregated server won't be able to post subjectaccessreviews (Grafana doesn't have this kind)
	// exact error: the server could not find the requested resource (post subjectaccessreviews.authorization.k8s.io)
	o.Options.RecommendedOptions.Authorization = nil

	o.Options.RecommendedOptions.Admission = nil
	o.Options.RecommendedOptions.Etcd = nil

	if o.Options.RecommendedOptions.CoreAPI.CoreAPIKubeconfigPath == "" {
		o.Options.RecommendedOptions.CoreAPI = nil
	}

	serverConfig := genericapiserver.NewRecommendedConfig(grafanaAPIServer.Codecs)

	if err := o.Options.ApplyTo(serverConfig); err != nil {
		return nil, fmt.Errorf("failed to apply options to server config: %w", err)
	}

	if factoryOptions := o.factory.GetOptions(); factoryOptions != nil {
		err := factoryOptions.ApplyTo(serverConfig)
		if err != nil {
			return nil, fmt.Errorf("factory's applyTo func failed: %s", err.Error())
		}
	}

	serverConfig.DisabledPostStartHooks = serverConfig.DisabledPostStartHooks.Insert("generic-apiserver-start-informers")
	serverConfig.DisabledPostStartHooks = serverConfig.DisabledPostStartHooks.Insert("priority-and-fairness-config-consumer")

	// Add OpenAPI specs for each group+version
	err := builder.SetupConfig(
		grafanaAPIServer.Scheme,
		serverConfig,
		o.builders,
		setting.BuildStamp,
		setting.BuildVersion,
		setting.BuildCommit,
		setting.BuildBranch,
		o.factory.GetOptionalMiddlewares(tracer)...,
	)
	return serverConfig, err
}

func (o *APIServerOptions) AddFlags(fs *pflag.FlagSet) {
	o.Options.AddFlags(fs)

	if factoryOptions := o.factory.GetOptions(); factoryOptions != nil {
		factoryOptions.AddFlags(fs)
	}
}

// Validate validates APIServerOptions
func (o *APIServerOptions) Validate() error {
	errors := make([]error, 0)

	if factoryOptions := o.factory.GetOptions(); factoryOptions != nil {
		errors = append(errors, factoryOptions.ValidateOptions()...)
	}

	if errs := o.Options.Validate(); len(errs) > 0 {
		errors = append(errors, errors...)
	}

	return utilerrors.NewAggregate(errors)
}

// Complete fills in fields required to have valid data
func (o *APIServerOptions) Complete() error {
	return nil
}

func (o *APIServerOptions) RunAPIServer(config *genericapiserver.RecommendedConfig, stopCh <-chan struct{}) error {
	delegationTarget := genericapiserver.NewEmptyDelegate()
	completedConfig := config.Complete()

	server, err := completedConfig.New("standalone-apiserver", delegationTarget)
	if err != nil {
		return err
	}

	// Install the API Group+version
	// #TODO figure out how to configure storage type in o.Options.StorageOptions
	err = builder.InstallAPIs(grafanaAPIServer.Scheme, grafanaAPIServer.Codecs, server, config.RESTOptionsGetter, o.builders, o.Options.StorageOptions,
		o.Options.MetricsOptions.MetricsRegisterer, nil, nil, // no need for server lock in standalone
	)
	if err != nil {
		return err
	}

	// write the local config to disk
	if o.Options.ExtraOptions.DevMode {
		if err = clientcmd.WriteToFile(
			utils.FormatKubeConfig(server.LoopbackClientConfig),
			path.Join(dataPath, "apiserver.kubeconfig"),
		); err != nil {
			return err
		}
	}

	if config.EnableProfiling {
		deltaProfiling{}.Install(server.Handler.NonGoRestfulMux)
	}

	return server.PrepareRun().Run(stopCh)
}

// deltaProfiling adds godeltapprof handlers for pprof under /debug/pprof.
type deltaProfiling struct{}

// Install register godeltapprof handlers to the given mux.
func (d deltaProfiling) Install(c *mux.PathRecorderMux) {
	c.UnlistedHandleFunc("/debug/pprof/delta_heap", pprof.Heap)
	c.UnlistedHandleFunc("/debug/pprof/delta_block", pprof.Block)
	c.UnlistedHandleFunc("/debug/pprof/delta_mutex", pprof.Mutex)
}
