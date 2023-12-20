package apiserver

import (
	"fmt"
	"io"
	"net"
	"path"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	utilerrors "k8s.io/apimachinery/pkg/util/errors"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/util/openapi"
	"k8s.io/client-go/tools/clientcmd"
	netutils "k8s.io/utils/net"

	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"

	"github.com/grafana/grafana/pkg/registry/apis/example"
	grafanaAPIServer "github.com/grafana/grafana/pkg/services/grafana-apiserver"
)

const (
	defaultEtcdPathPrefix = "/registry/grafana.app"
	dataPath              = "data/grafana-apiserver" // same as grafana core
)

var (
	Scheme = runtime.NewScheme()
	Codecs = serializer.NewCodecFactory(Scheme)

	unversionedVersion = schema.GroupVersion{Group: "", Version: "v1"}
	unversionedTypes   = []runtime.Object{
		&metav1.Status{},
		&metav1.WatchEvent{},
		&metav1.APIVersions{},
		&metav1.APIGroupList{},
		&metav1.APIGroup{},
		&metav1.APIResourceList{},
	}
)

func init() {
	// we need to add the options to empty v1
	metav1.AddToGroupVersion(Scheme, schema.GroupVersion{Group: "", Version: "v1"})
	Scheme.AddUnversionedTypes(unversionedVersion, unversionedTypes...)
}

// APIServerOptions contains the state for the apiserver
type APIServerOptions struct {
	builders           []grafanaAPIServer.APIGroupBuilder
	RecommendedOptions *options.RecommendedOptions
	AlternateDNS       []string

	StdOut io.Writer
	StdErr io.Writer
}

func newAPIServerOptions(out, errOut io.Writer) *APIServerOptions {
	return &APIServerOptions{
		StdOut: out,
		StdErr: errOut,
	}
}

func (o *APIServerOptions) LoadAPIGroupBuilders(args []string) error {
	o.builders = []grafanaAPIServer.APIGroupBuilder{}
	for _, g := range args {
		switch g {
		// No dependencies for testing
		case "example.grafana.app":
			o.builders = append(o.builders, example.NewTestingAPIBuilder())
		default:
			return fmt.Errorf("unknown group: %s", g)
		}
	}

	if len(o.builders) < 1 {
		return fmt.Errorf("expected group name(s) in the command line arguments")
	}

	// Install schemas
	for _, b := range o.builders {
		if err := b.InstallSchema(Scheme); err != nil {
			return err
		}
	}
	return nil
}

// A copy of ApplyTo in recommended.go, but for >= 0.28, server pkg in apiserver does a bit extra causing
// a panic when CoreAPI is set to nil
func (o *APIServerOptions) ModifiedApplyTo(config *genericapiserver.RecommendedConfig) error {
	if err := o.RecommendedOptions.Etcd.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.EgressSelector.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Traces.ApplyTo(config.Config.EgressSelector, &config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.SecureServing.ApplyTo(&config.Config.SecureServing, &config.Config.LoopbackClientConfig); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Authentication.ApplyTo(&config.Config.Authentication, config.SecureServing, config.OpenAPIConfig); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Authorization.ApplyTo(&config.Config.Authorization); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Audit.ApplyTo(&config.Config); err != nil {
		return err
	}
	//if err := o.RecommendedOptions.Features.ApplyTo(&config.Config); err != nil {
	//	return err
	//}

	if err := o.RecommendedOptions.CoreAPI.ApplyTo(config); err != nil {
		return err
	}

	_, err := o.RecommendedOptions.ExtraAdmissionInitializers(config)
	if err != nil {
		return err
	}
	return nil
}

func (o *APIServerOptions) Config() (*genericapiserver.RecommendedConfig, error) {
	if err := o.RecommendedOptions.SecureServing.MaybeDefaultWithSelfSignedCerts(
		"localhost", o.AlternateDNS, []net.IP{netutils.ParseIPSloppy("127.0.0.1")},
	); err != nil {
		return nil, fmt.Errorf("error creating self-signed certificates: %v", err)
	}

	o.RecommendedOptions.Authentication.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.RemoteKubeConfigFileOptional = true

	o.RecommendedOptions.Admission = nil
	o.RecommendedOptions.Etcd = nil

	if o.RecommendedOptions.CoreAPI.CoreAPIKubeconfigPath == "" {
		o.RecommendedOptions.CoreAPI = nil
	}

	serverConfig := genericapiserver.NewRecommendedConfig(Codecs)

	if o.RecommendedOptions.CoreAPI == nil {
		if err := o.ModifiedApplyTo(serverConfig); err != nil {
			return nil, err
		}
	} else {
		if err := o.RecommendedOptions.ApplyTo(serverConfig); err != nil {
			return nil, err
		}
	}

	// Add OpenAPI specs for each group+version
	defsGetter := grafanaAPIServer.GetOpenAPIDefinitions(o.builders)
	serverConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(
		openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(defsGetter),
		openapinamer.NewDefinitionNamer(Scheme))

	serverConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(
		openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(defsGetter),
		openapinamer.NewDefinitionNamer(Scheme))

	return serverConfig, nil
}

// Validate validates APIServerOptions
// NOTE: we don't call validate on the top level recommended options as it doesn't like skipping etcd-servers
// the function is left here for troubleshooting any other config issues
func (o *APIServerOptions) Validate(args []string) error {
	errors := []error{}
	errors = append(errors, o.RecommendedOptions.Validate()...)
	return utilerrors.NewAggregate(errors)
}

// Complete fills in fields required to have valid data
func (o *APIServerOptions) Complete() error {
	return nil
}

func (o *APIServerOptions) RunAPIServer(config *genericapiserver.RecommendedConfig, stopCh <-chan struct{}) error {
	delegationTarget := genericapiserver.NewEmptyDelegate()
	completedConfig := config.Complete()
	server, err := completedConfig.New("example-apiserver", delegationTarget)
	if err != nil {
		return err
	}

	// Install the API Group+version
	for _, b := range o.builders {
		g, err := b.GetAPIGroupInfo(Scheme, Codecs, completedConfig.RESTOptionsGetter)
		if err != nil {
			return err
		}
		if g == nil || len(g.PrioritizedVersions) < 1 {
			continue
		}
		err = server.InstallAPIGroup(g)
		if err != nil {
			return err
		}
	}

	// in standalone mode, write the local config to disk
	if o.RecommendedOptions.CoreAPI == nil {
		if err = clientcmd.WriteToFile(
			utils.FormatKubeConfig(server.LoopbackClientConfig),
			path.Join(dataPath, "grafana.kubeconfig"),
		); err != nil {
			return err
		}
	}

	return server.PrepareRun().Run(stopCh)
}
