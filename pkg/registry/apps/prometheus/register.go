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
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
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
	ac ac.AccessControl,
) *PrometheusAppProvider {
	provider := &PrometheusAppProvider{
		cfg:     cfg,
		service: p,
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: prometheusv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     prometheusapp.GetKinds(),
		// TODO internally it looks like we're still using dual store  writer. We want single store for now (legacy only)
		LegacyStorageGetter: provider.legacyStorageGetter,
		// TODO add authorizer if we need custom permissions
		Authorizer: provider.authorizer(ac),
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

	// TODO how does this work for unstructured objects?
	legacyStore.tableConverter = utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "APIVersion", Type: "string", Format: "string", Description: "API Version"},
				{Name: "Created At", Type: "date"},
			},
			Reader: func(obj any) ([]interface{}, error) {
				m, ok := obj.(*datasources.DataSource)
				if !ok {
					return nil, fmt.Errorf("expected prometheus")
				}
				return []interface{}{
					m.Name,
					m.APIVersion,
					m.Created.UTC().Format(time.RFC3339),
				}, nil
			},
		},
	)
	return legacyStore
}
