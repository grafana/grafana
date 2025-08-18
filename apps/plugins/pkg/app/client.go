package app

import (
	"errors"
	"sync"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

type InstallClient = *resource.TypedStore[*pluginsv0alpha1.PluginInstall]

var (
	ErrInstallAPINotEnabled = errors.New("install API is not enabled")
	ErrInvalidAppConfig     = errors.New("invalid app config")

	appConfig         *app.Config
	configReady       = make(chan struct{})
	getClientRegistry = sync.OnceValue(func() *k8s.ClientRegistry {
		<-configReady
		reg := k8s.NewClientRegistry(appConfig.KubeConfig, k8s.ClientConfig{
			MetricsConfig: metrics.Config{
				Namespace: appConfig.ManifestData.AppName,
			},
		})
		return reg
	})
)

func NewInstallClient() (InstallClient, error) {
	clientRegistry := getClientRegistry()
	cfg, ok := appConfig.SpecificConfig.(*Config)
	if !ok {
		return nil, ErrInvalidAppConfig
	}

	gvr := schema.GroupVersionResource{
		Group:    pluginsv0alpha1.GroupVersion.Group,
		Version:  pluginsv0alpha1.GroupVersion.Version,
		Resource: pluginsv0alpha1.PluginInstallKind().Plural(),
	}
	if !cfg.ResourceConfig.ResourceEnabled(gvr) {
		return nil, ErrInstallAPINotEnabled
	}

	return resource.NewTypedStore[*pluginsv0alpha1.PluginInstall](pluginsv0alpha1.PluginInstallKind(), clientRegistry)
}
