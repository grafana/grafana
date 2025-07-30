package shorturl

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/shorturl/pkg/apis"
	shorturl "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1alpha1"
	shorturlapp "github.com/grafana/grafana/apps/shorturl/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*ShortURLAppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*ShortURLAppInstaller)(nil)
)

type ShortURLAppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg     *setting.Cfg
	service shorturls.Service
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	service shorturls.Service,
) (*ShortURLAppInstaller, error) {
	installer := &ShortURLAppInstaller{
		cfg:     cfg,
		service: service,
	}
	specificConfig := any(&shorturlapp.ShortURLConfig{
		AppURL: cfg.AppURL,
	})
	provider := simple.NewAppProvider(apis.LocalManifest(), specificConfig, shorturlapp.New)

	appCfg := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appCfg, apis.ManifestGoTypeAssociator, apis.ManifestCustomRouteResponsesAssociator)
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

func (s *ShortURLAppInstaller) GetLegacyStorage(requested schema.GroupVersionResource) grafanarest.Storage {
	gvr := schema.GroupVersionResource{
		Group:    shorturl.ShortURLKind().Group(),
		Version:  shorturl.ShortURLKind().Version(),
		Resource: shorturl.ShortURLKind().Plural(),
	}
	if requested.String() != gvr.String() {
		return nil
	}
	legacyStore := &legacyStorage{
		service:    s.service,
		namespacer: request.GetNamespaceMapper(s.cfg),
	}
	legacyStore.tableConverter = utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "UID", Type: "string", Format: "string", Description: "The random string identifier"},
				{Name: "Path", Type: "string", Format: "string", Description: "The short url path"},
				{Name: "Last Seen At", Type: "number"},
			},
			Reader: func(obj any) ([]interface{}, error) {
				m, ok := obj.(*shorturl.ShortURL)
				if !ok {
					return nil, fmt.Errorf("expected shorturl")
				}
				return []interface{}{
					m.Name,
					m.Spec.Uid,
					m.Spec.Path,
					m.Spec.LastSeenAt,
				}, nil
			},
		},
	)
	return legacyStore
}
