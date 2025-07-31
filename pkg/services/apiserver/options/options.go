package options

import (
	"net"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
	genericapiserver "k8s.io/apiserver/pkg/server"
	genericoptions "k8s.io/apiserver/pkg/server/options"

	"github.com/spf13/pflag"
)

type OptionsProvider interface {
	AddFlags(fs *pflag.FlagSet)
	ApplyTo(config *genericapiserver.RecommendedConfig) error
	ValidateOptions() []error
}

const defaultEtcdPathPrefix = "/registry/grafana.app"

type Options struct {
	RecommendedOptions       *genericoptions.RecommendedOptions
	GrafanaAggregatorOptions *GrafanaAggregatorOptions
	StorageOptions           *StorageOptions
	ExtraOptions             *ExtraOptions
	APIOptions               []OptionsProvider
}

func NewOptions(codec runtime.Codec) *Options {
	return &Options{
		RecommendedOptions:       NewRecommendedOptions(codec),
		GrafanaAggregatorOptions: NewGrafanaAggregatorOptions(),
		StorageOptions:           NewStorageOptions(),
		ExtraOptions:             NewExtraOptions(),
	}
}

func (o *Options) AddFlags(fs *pflag.FlagSet) {
	o.RecommendedOptions.AddFlags(fs)
	o.GrafanaAggregatorOptions.AddFlags(fs)
	o.StorageOptions.AddFlags(fs)
	o.ExtraOptions.AddFlags(fs)

	for _, api := range o.APIOptions {
		api.AddFlags(fs)
	}
}

func (o *Options) Validate() []error {
	if errs := o.ExtraOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if errs := o.StorageOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if errs := o.GrafanaAggregatorOptions.Validate(); len(errs) != 0 {
		return errs
	}

	if errs := o.RecommendedOptions.SecureServing.Validate(); len(errs) != 0 {
		return errs
	}

	if o.ExtraOptions.DevMode {
		// NOTE: Only consider authn for dev mode - resolves the failure due to missing extension apiserver auth-config
		// in parent k8s
		if errs := o.RecommendedOptions.Authentication.Validate(); len(errs) != 0 {
			return errs
		}
	}

	if o.StorageOptions.StorageType == StorageTypeEtcd {
		if errs := o.RecommendedOptions.Etcd.Validate(); len(errs) != 0 {
			return errs
		}
	}

	for _, api := range o.APIOptions {
		if errs := api.ValidateOptions(); len(errs) != 0 {
			return errs
		}
	}
	return nil
}

func (o *Options) ApplyTo(serverConfig *genericapiserver.RecommendedConfig) error {
	serverConfig.AggregatedDiscoveryGroupManager = aggregated.NewResourceManager("apis")

	// avoid picking up an in-cluster service account token
	o.RecommendedOptions.Authentication.SkipInClusterLookup = true

	if err := o.ExtraOptions.ApplyTo(serverConfig); err != nil {
		return err
	}

	if !o.ExtraOptions.DevMode {
		o.RecommendedOptions.SecureServing.Listener = newFakeListener()
	}

	if err := o.RecommendedOptions.SecureServing.ApplyTo(&serverConfig.SecureServing, &serverConfig.LoopbackClientConfig); err != nil {
		return err
	}

	if err := o.RecommendedOptions.Authentication.ApplyTo(&serverConfig.Authentication, serverConfig.SecureServing, serverConfig.OpenAPIConfig); err != nil {
		return err
	}

	if !o.ExtraOptions.DevMode {
		if err := serverConfig.SecureServing.Listener.Close(); err != nil {
			return err
		}
		serverConfig.SecureServing = nil
	}
	return nil
}

func NewRecommendedOptions(codec runtime.Codec) *genericoptions.RecommendedOptions {
	return genericoptions.NewRecommendedOptions(
		defaultEtcdPathPrefix,
		codec,
	)
}

type fakeListener struct {
	server net.Conn
	client net.Conn
}

func newFakeListener() *fakeListener {
	server, client := net.Pipe()
	return &fakeListener{
		server: server,
		client: client,
	}
}

func (f *fakeListener) Accept() (net.Conn, error) {
	return f.server, nil
}

func (f *fakeListener) Close() error {
	if err := f.client.Close(); err != nil {
		return err
	}
	return f.server.Close()
}

func (f *fakeListener) Addr() net.Addr {
	return &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 3000, Zone: ""}
}
