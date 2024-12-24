package advisor

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	advisor "github.com/grafana/grafana/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/registry/apis/advisor/datasourcecheck"
	"github.com/grafana/grafana/pkg/registry/apis/advisor/plugincheck"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

var _ builder.APIGroupBuilder = (*AdvisorAPIBuilder)(nil)

type AdvisorAPIBuilder struct {
	datasourceSvc         datasources.DataSourceService
	pluginRepo            repo.Service
	pluginStore           pluginstore.Store
	pluginContextProvider *plugincontext.Provider
	pluginClient          plugins.Client

	namespacer request.NamespaceMapper
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	cfg *setting.Cfg,
	datasourceSvc datasources.DataSourceService,
	pluginStore pluginstore.Store,
	pluginRepo repo.Service,
	pluginContextProvider *plugincontext.Provider,
	pluginClient plugins.Client,
) *AdvisorAPIBuilder {
	// TODO: Add a feature flag

	builder := &AdvisorAPIBuilder{
		namespacer:            request.GetNamespaceMapper(cfg),
		datasourceSvc:         datasourceSvc,
		pluginRepo:            pluginRepo,
		pluginStore:           pluginStore,
		pluginContextProvider: pluginContextProvider,
		pluginClient:          pluginClient,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *AdvisorAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return advisor.SchemeGroupVersion
}

func (b *AdvisorAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	// Each check schema needs to be registered here
	if err := datasourcecheck.AddKnownTypes(scheme); err != nil {
		return err
	}
	if err := plugincheck.AddKnownTypes(scheme); err != nil {
		return err
	}
	return nil
}

func (b *AdvisorAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	addStorage := func(gvr schema.GroupVersionResource, s rest.Storage) {
		v, ok := apiGroupInfo.VersionedResourcesStorageMap[gvr.Version]
		if !ok {
			v = map[string]rest.Storage{}
			apiGroupInfo.VersionedResourcesStorageMap[gvr.Version] = v
		}
		v[gvr.Resource] = s
	}

	// Each check storage needs to be registered here
	dscheckStorage, err := datasourcecheck.NewStorage(opts.Scheme, opts.OptsGetter, b.datasourceSvc, b.pluginContextProvider, b.pluginClient)
	if err != nil {
		return fmt.Errorf("failed to initialize route storage: %w", err)
	}
	addStorage(datasourcecheck.ResourceInfo.GroupVersionResource(), dscheckStorage)

	plugincheckStorage, err := plugincheck.NewStorage(opts.Scheme, opts.OptsGetter, b.pluginStore, b.pluginRepo)
	if err != nil {
		return fmt.Errorf("failed to initialize route storage: %w", err)
	}
	addStorage(plugincheck.ResourceInfo.GroupVersionResource(), plugincheckStorage)

	return nil
}

func (b *AdvisorAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return advisor.GetOpenAPIDefinitions
}

func (b *AdvisorAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			switch a.GetResource() {
			// Each check authorizer needs to be registered here
			case datasourcecheck.ResourceInfo.GroupResource().Resource:
				return datasourcecheck.Authorize(ctx, nil, a)
			case plugincheck.ResourceInfo.GroupResource().Resource:
				return plugincheck.Authorize(ctx, nil, a)
			}
			return authorizer.DecisionNoOpinion, "", nil
		})
}
