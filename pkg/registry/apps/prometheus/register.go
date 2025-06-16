package prometheus

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/prometheus/pkg/apis"
	prometheusv0alpha1 "github.com/grafana/grafana/apps/prometheus/pkg/apis/prometheus/v0alpha1"
	prometheusapp "github.com/grafana/grafana/apps/prometheus/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	datasourceservice "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apimachinery/pkg/runtime/schema"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PrometheusAppProvider struct {
	app.Provider
	cfg     *setting.Cfg
	service *datasourceservice.Service
}

func RegisterApp(
	p *datasourceservice.Service,
	cfg *setting.Cfg,
) *PrometheusAppProvider {
	provider := &PrometheusAppProvider{
		cfg:     cfg,
		service: p,
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter:    prometheusv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:        prometheusapp.GetKinds(),
		LegacyStorageGetter: provider.legacyStorageGetter,
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, prometheusapp.New)
	return provider
}

func (p *PrometheusAppProvider) legacyStorageGetter(requested schema.GroupVersionResource) grafanarest.Storage {
	gvr := schema.GroupVersionResource{
		Group:    prometheusv0alpha1.PrometheusKind().Group(),
		Version:  prometheusv0alpha1.PrometheusKind().Version(),
		Resource: prometheusv0alpha1.PrometheusKind().Plural(),
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

			// TODO update these for datasources
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Created At", Type: "date"},
			},
			Reader: func(obj any) ([]interface{}, error) {
				m, ok := obj.(*datasources.DataSource)
				if !ok {
					return nil, fmt.Errorf("expected prometheus")
				}
				return []interface{}{
					m.Name,

					m.Created.UTC().Format(time.RFC3339),
				}, nil
			},
		},
	)
	return legacyStore
}
