package app

import (
	"sync"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/resource"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

type InstallClient = *resource.TypedStore[*pluginsv0alpha1.PluginInstall]

var (
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
	return resource.NewTypedStore[*pluginsv0alpha1.PluginInstall](pluginsv0alpha1.PluginInstallKind(), clientRegistry)
}
