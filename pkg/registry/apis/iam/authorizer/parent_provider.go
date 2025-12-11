package authorizer

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/authlib/authn"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/provisioning/pkg/auth"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var (
	ErrNoConfigProvider = errors.New("no config provider for group resource")
	ErrNoVersionInfo    = errors.New("no version info for group resource")

	Versions = map[schema.GroupResource]string{
		{Group: folderv1.GROUP, Resource: folderv1.RESOURCE}:                 folderv1.VERSION,
		{Group: dashboardv1.GROUP, Resource: dashboardv1.DASHBOARD_RESOURCE}: dashboardv1.VERSION,
	}
)

// ConfigProvider is a function that provides a rest.Config for a given context.
type ConfigProvider func(ctx context.Context) (*rest.Config, error)

// DynamicClientFactory is a function that creates a dynamic.Interface from a rest.Config.
// This can be overridden in tests.
type DynamicClientFactory func(config *rest.Config) (dynamic.Interface, error)

// ParentProvider implementation that fetches the parent folder information from remote API servers.
type ParentProviderImpl struct {
	configProviders      map[schema.GroupResource]ConfigProvider
	versions             map[schema.GroupResource]string
	dynamicClientFactory DynamicClientFactory
}

// DialConfig holds the configuration for dialing a remote API server.
type DialConfig struct {
	Host     string
	Insecure bool
	CAFile   string
	Audience string
}

// NewLocalConfigProvider creates a map of ConfigProviders that return the same given config for local API servers.
func NewLocalConfigProvider(
	configProvider ConfigProvider,
) map[schema.GroupResource]ConfigProvider {
	return map[schema.GroupResource]ConfigProvider{
		{Group: folderv1.GROUP, Resource: folderv1.RESOURCE}:                 configProvider,
		{Group: dashboardv1.GROUP, Resource: dashboardv1.DASHBOARD_RESOURCE}: configProvider,
	}
}

// NewRemoteConfigProvider creates a map of ConfigProviders for remote API servers based on the given DialConfig.
func NewRemoteConfigProvider(cfg map[schema.GroupResource]DialConfig, exchangeClient authn.TokenExchanger) map[schema.GroupResource]ConfigProvider {
	configProviders := make(map[schema.GroupResource]ConfigProvider, 2)
	for gr, dialConfig := range cfg {
		configProviders[gr] = func(ctx context.Context) (*rest.Config, error) {
			return &rest.Config{
				Host: dialConfig.Host,
				WrapTransport: func(rt http.RoundTripper) http.RoundTripper {
					return auth.NewRoundTripper(exchangeClient, rt, dialConfig.Audience)
				},
				TLSClientConfig: rest.TLSClientConfig{
					Insecure: dialConfig.Insecure,
					CAFile:   dialConfig.CAFile,
				},
				QPS:   50,
				Burst: 100,
			}, nil
		}
	}
	return configProviders
}

// NewApiParentProvider creates a new ParentProviderImpl with the given config providers and version info.
func NewApiParentProvider(
	configProviders map[schema.GroupResource]ConfigProvider,
	version map[schema.GroupResource]string,
) *ParentProviderImpl {
	return &ParentProviderImpl{
		configProviders: configProviders,
		versions:        version,
		dynamicClientFactory: func(config *rest.Config) (dynamic.Interface, error) {
			return dynamic.NewForConfig(config)
		},
	}
}

func (p *ParentProviderImpl) HasParent(gr schema.GroupResource) bool {
	_, ok := p.configProviders[gr]
	return ok
}

func (p *ParentProviderImpl) GetParent(ctx context.Context, gr schema.GroupResource, namespace, name string) (string, error) {
	provider, ok := p.configProviders[gr]
	if !ok {
		return "", fmt.Errorf("%w: %s", ErrNoConfigProvider, gr.String())
	}
	restConfig, err := provider(ctx)
	if err != nil {
		return "", err
	}

	client, err := p.dynamicClientFactory(restConfig)
	if err != nil {
		return "", err
	}
	version, ok := p.versions[gr]
	if !ok {
		return "", fmt.Errorf("%w: %s", ErrNoVersionInfo, gr.String())
	}
	resourceClient := client.Resource(schema.GroupVersionResource{
		Group:    gr.Group,
		Resource: gr.Resource,
		Version:  version,
	}).Namespace(namespace)

	unstructObj, err := resourceClient.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}

	return unstructObj.GetAnnotations()[utils.AnnoKeyFolder], nil
}
