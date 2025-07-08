package shorturl

import (
	"fmt"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/shorturl/pkg/apis"
	shorturlv0alpha1 "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v0alpha1"
	shorturlapp "github.com/grafana/grafana/apps/shorturl/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/setting"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type ShortURLAppProvider struct {
	app.Provider
	cfg     *setting.Cfg
	service shorturls.Service
	logger  log.Logger
}

func RegisterApp(
	cfg *setting.Cfg,
	service shorturls.Service,
) *ShortURLAppProvider {
	provider := &ShortURLAppProvider{
		cfg:     cfg,
		service: service,
		logger:  log.New("shorturl::RawHandlers"),
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter:    shorturlv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:        shorturlapp.GetKinds(),
		LegacyStorageGetter: provider.legacyStorageGetter,
		CustomConfig: any(&shorturlapp.ShortURLConfig{
			AppURL: cfg.AppURL,
		}),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, shorturlapp.New)
	return provider
}

func (p *ShortURLAppProvider) legacyStorageGetter(requested schema.GroupVersionResource) grafanarest.Storage {
	gvr := schema.GroupVersionResource{
		Group:    shorturlv0alpha1.ShortURLKind().Group(),
		Version:  shorturlv0alpha1.ShortURLKind().Version(),
		Resource: shorturlv0alpha1.ShortURLKind().Plural(),
	}
	if requested.String() != gvr.String() {
		return nil
	}
	legacyStore := &legacyStorage{
		service:    p.service,
		namespacer: request.GetNamespaceMapper(p.cfg),
	}
	legacyStore.tableConverter = utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "UID", Type: "string", Format: "string", Description: "The random string identifier"},
				{Name: "Path", Type: "string", Format: "string", Description: "The short url path"},
				{Name: "Last Seen At", Type: "date"},
			},
			Reader: func(obj any) ([]interface{}, error) {
				m, ok := obj.(*shorturlv0alpha1.ShortURL)
				if !ok {
					return nil, fmt.Errorf("expected shorturl")
				}
				return []interface{}{
					m.Name,
					m.UID,
					m.Spec.Path,
					m.Spec.LastSeenAt,
				}, nil
			},
		},
	)
	return legacyStore
}
