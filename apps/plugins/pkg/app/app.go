package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	restclient "k8s.io/client-go/rest"
	"k8s.io/klog/v2"

	authlib "github.com/grafana/authlib/types"
	pluginsappapis "github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
)

func New(cfg app.Config) (app.App, error) {
	specificConfig, ok := cfg.SpecificConfig.(*PluginAppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}

	simpleConfig := simple.AppConfig{
		Name:       "plugins",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					klog.ErrorS(err, "Informer processing error")
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: pluginsv0alpha1.PluginKind(),
			},
			{
				Kind: pluginsv0alpha1.MetaKind(),
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	// Register MetaProviderManager as a runnable so its cleanup goroutine is managed by the app lifecycle
	a.AddRunnable(specificConfig.MetaProviderManager)

	return a, nil
}

type PluginAppConfig struct {
	MetaProviderManager *meta.ProviderManager
}

func ProvideAppInstaller(
	metaProviderManager *meta.ProviderManager,
) (*PluginAppInstaller, error) {
	specificConfig := &PluginAppConfig{
		MetaProviderManager: metaProviderManager,
	}
	provider := simple.NewAppProvider(pluginsappapis.LocalManifest(), specificConfig, New)
	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *pluginsappapis.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	defaultInstaller, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, pluginsappapis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}

	appInstaller := &PluginAppInstaller{
		AppInstaller: defaultInstaller,
		metaManager:  metaProviderManager,
		ready:        make(chan struct{}),
	}
	return appInstaller, nil
}

func (p *PluginAppInstaller) WithAccessChecker(access authlib.AccessChecker) *PluginAppInstaller {
	p.access = access
	return p
}

type PluginAppInstaller struct {
	appsdkapiserver.AppInstaller
	metaManager *meta.ProviderManager
	access      authlib.AccessChecker

	// restConfig is set during InitializeApp and used by the client factory
	restConfig *restclient.Config
	ready      chan struct{}
}

func (p *PluginAppInstaller) InitializeApp(restConfig restclient.Config) error {
	if p.restConfig == nil {
		p.restConfig = &restConfig
		close(p.ready)
	}
	return p.AppInstaller.InitializeApp(restConfig)
}

func (p *PluginAppInstaller) InstallAPIs(
	server appsdkapiserver.GenericAPIServer,
	restOptsGetter generic.RESTOptionsGetter,
) error {
	// Create a client factory function that will be called lazily when the client is needed.
	// This uses the rest config from the app, which is set during InitializeApp.
	clientFactory := func(ctx context.Context) (*pluginsv0alpha1.PluginClient, error) {
		<-p.ready
		if p.restConfig == nil {
			return nil, fmt.Errorf("rest config not yet initialized, app must be initialized before client can be created")
		}

		clientGenerator := k8s.NewClientRegistry(*p.restConfig, k8s.DefaultClientConfig())
		client, err := pluginsv0alpha1.NewPluginClientFromGenerator(clientGenerator)
		if err != nil {
			return nil, fmt.Errorf("failed to create plugin client: %w", err)
		}

		return client, nil
	}

	pluginMetaGVR := pluginsv0alpha1.MetaKind().GroupVersionResource()
	replacedStorage := map[schema.GroupVersionResource]rest.Storage{
		pluginMetaGVR: NewMetaStorage(p.metaManager, clientFactory),
	}
	wrappedServer := &customStorageWrapper{
		wrapped: server,
		replace: replacedStorage,
	}
	return p.AppInstaller.InstallAPIs(wrappedServer, restOptsGetter)
}

func (p *PluginAppInstaller) GetAuthorizer() authorizer.Authorizer {
	if p.access == nil {
		return nil
	}

	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error) {
			info, ok := authlib.AuthInfoFrom(ctx)
			if !ok {
				return authorizer.DecisionDeny, "failed to get auth info", nil
			}

			res, err := p.access.Check(ctx, info, authlib.CheckRequest{
				Verb:        a.GetVerb(),
				Group:       a.GetAPIGroup(),
				Resource:    a.GetResource(),
				Name:        a.GetName(),
				Namespace:   a.GetNamespace(),
				Subresource: a.GetSubresource(),
				Path:        a.GetPath(),
			}, "")
			if err != nil {
				return authorizer.DecisionDeny, "failed to perform authorization", err
			}

			if !res.Allowed {
				return authorizer.DecisionDeny, "permission denied", nil
			}

			return authorizer.DecisionAllow, "", nil
		})
}
