package apiserver

import (
	"fmt"
	"io"
	"net"
	"path"

	"github.com/grafana/grafana/pkg/cmd/grafana/apiserver/auth"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilerrors "k8s.io/apimachinery/pkg/util/errors"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/client-go/tools/clientcmd"
	netutils "k8s.io/utils/net"

	"github.com/grafana/grafana/pkg/apiserver/builder"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	grafanaAPIServer "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	standaloneoptions "github.com/grafana/grafana/pkg/services/apiserver/standalone/options"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/spf13/pflag"
)

const (
	defaultEtcdPathPrefix = "/registry/grafana.app"
	dataPath              = "data/grafana-apiserver" // same as grafana core
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

func (o *APIServerOptions) loadAPIGroupBuilders(tracer tracing.Tracer, apis []schema.GroupVersion) error {
	o.builders = []builder.APIGroupBuilder{}
	for _, gv := range apis {
		api, err := o.factory.MakeAPIServer(tracer, gv)
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

func (o *APIServerOptions) Config() (*genericapiserver.RecommendedConfig, error) {
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

	validator, err := auth.NewValidator()
	if err != nil {
		return nil, err
	}
	serverConfig.Authentication.Authenticator = auth.NewTokenAuthenticator(validator)
	serverConfig.Authorization.Authorizer = auth.NewTokenAuthorizer()
	serverConfig.DisabledPostStartHooks = serverConfig.DisabledPostStartHooks.Insert("generic-apiserver-start-informers")
	serverConfig.DisabledPostStartHooks = serverConfig.DisabledPostStartHooks.Insert("priority-and-fairness-config-consumer")

	// Add OpenAPI specs for each group+version
	err = builder.SetupConfig(
		grafanaAPIServer.Scheme,
		serverConfig,
		o.builders,
		setting.BuildStamp,
		setting.BuildVersion,
		setting.BuildCommit,
		setting.BuildBranch,
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
	err = builder.InstallAPIs(grafanaAPIServer.Scheme, grafanaAPIServer.Codecs, server, config.RESTOptionsGetter, o.builders, true)
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

	return server.PrepareRun().Run(stopCh)
}
