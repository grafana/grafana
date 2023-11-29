package apiserver

import (
	"fmt"
	"io"
	"net"

	"github.com/grafana/grafana/pkg/registry/apis/example"
	grafanaAPIServer "github.com/grafana/grafana/pkg/services/grafana-apiserver"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	utilerrors "k8s.io/apimachinery/pkg/util/errors"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	netutils "k8s.io/utils/net"
)

const defaultEtcdPathPrefix = "/registry/example.grafana.app"

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

// ExampleServerOptions contains the state for the apiserver
type ExampleServerOptions struct {
	builders           []grafanaAPIServer.APIGroupBuilder
	RecommendedOptions *options.RecommendedOptions
	AlternateDNS       []string

	StdOut io.Writer
	StdErr io.Writer
}

func newExampleServerOptions(out, errOut io.Writer) *ExampleServerOptions {
	return &ExampleServerOptions{
		StdOut: out,
		StdErr: errOut,
	}
}

func (o *ExampleServerOptions) LoadAPIGroupBuilders(args []string) error {
	o.builders = []grafanaAPIServer.APIGroupBuilder{}
	for _, g := range args {
		switch g {
		// No dependencies for testing
		case "example.grafana.app":
			o.builders = append(o.builders, &example.TestingAPIBuilder{})
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

func (o *ExampleServerOptions) Config() (*genericapiserver.RecommendedConfig, error) {
	if err := o.RecommendedOptions.SecureServing.MaybeDefaultWithSelfSignedCerts("localhost", o.AlternateDNS, []net.IP{netutils.ParseIPSloppy("127.0.0.1")}); err != nil {
		return nil, fmt.Errorf("error creating self-signed certificates: %v", err)
	}

	o.RecommendedOptions.Authentication.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.RemoteKubeConfigFileOptional = true

	o.RecommendedOptions.Admission = nil
	o.RecommendedOptions.CoreAPI = nil
	o.RecommendedOptions.Etcd = nil

	serverConfig := genericapiserver.NewRecommendedConfig(Codecs)

	if err := o.RecommendedOptions.ApplyTo(serverConfig); err != nil {
		return nil, err
	}

	return serverConfig, nil
}

// Validate validates ExampleServerOptions
// NOTE: we don't call validate on the top level recommended options as it doesn't like skipping etcd-servers
// the function is left here for troubleshooting any other config issues
func (o *ExampleServerOptions) Validate(args []string) error {
	errors := []error{}
	errors = append(errors, o.RecommendedOptions.Validate()...)
	return utilerrors.NewAggregate(errors)
}

// Complete fills in fields required to have valid data
func (o *ExampleServerOptions) Complete() error {
	return nil
}

func (o *ExampleServerOptions) RunExampleServer(config *genericapiserver.RecommendedConfig, stopCh <-chan struct{}) error {
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

	return server.PrepareRun().Run(stopCh)
}
