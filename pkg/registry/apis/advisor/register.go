package advisor

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	advisor "github.com/grafana/grafana/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/registry/apis/advisor/datasourcecheck"
	"github.com/grafana/grafana/pkg/registry/apis/advisor/models"
	"github.com/grafana/grafana/pkg/registry/apis/advisor/plugincheck"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
)

var (
	_ builder.APIGroupBuilder = (*AdvisorAPIBuilder)(nil)
)

type AdvisorAPIBuilder struct {
	models.AdvisorAPIServices

	namespacer request.NamespaceMapper
	checks     []models.Check
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

	apvs := models.AdvisorAPIServices{
		DatasourceSvc:         datasourceSvc,
		PluginRepo:            pluginRepo,
		PluginStore:           pluginStore,
		PluginContextProvider: pluginContextProvider,
		PluginClient:          pluginClient,
	}

	checks := []models.Check{
		// Register new checks here
		datasourcecheck.New(&apvs),
		plugincheck.New(&apvs),
	}
	builder := &AdvisorAPIBuilder{
		namespacer:         request.GetNamespaceMapper(cfg),
		AdvisorAPIServices: apvs,
		checks:             checks,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *AdvisorAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return advisor.SchemeGroupVersion
}

func resourceInfo(check models.Check) utils.ResourceInfo {
	// Each check has its own resource info, multiple checks can reuse the same resource info if they are related
	return utils.NewResourceInfo(advisor.GROUP, advisor.VERSION,
		check.Name(), check.Name(), check.Kind(), check.Object, check.ObjectList,
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Created At", Type: "date"},
			},
			Reader: func(obj any) ([]interface{}, error) {
				meta, err := utils.MetaAccessor(obj)
				if err != nil {
					return nil, err
				}
				return []interface{}{
					meta.GetName(),
					meta.GetCreationTimestamp().UTC().Format(time.RFC3339),
				}, nil
			},
		}, // default table converter
	)
}

func (b *AdvisorAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	for _, check := range b.checks {
		ri := resourceInfo(check)
		scheme.AddKnownTypes(ri.GroupVersion(), ri.NewFunc(), ri.NewListFunc())
		metav1.AddToGroupVersion(scheme, ri.GroupVersion())
	}
	return nil
}

func (b *AdvisorAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	for _, check := range b.checks {
		ri := resourceInfo(check)
		controller := newController(check)
		storage, err := newStorage(opts.Scheme, opts.OptsGetter, check, ri, controller.GetChan())
		if err != nil {
			return fmt.Errorf("failed to initialize storage: %w", err)
		}
		gvr := ri.GroupVersionResource()
		v, ok := apiGroupInfo.VersionedResourcesStorageMap[gvr.Version]
		if !ok {
			v = map[string]rest.Storage{}
			apiGroupInfo.VersionedResourcesStorageMap[gvr.Version] = v
		}
		v[gvr.Resource] = storage
		controller.SetStorage(storage)
		go controller.Run(context.Background())
	}
	return nil
}

func (b *AdvisorAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return advisor.GetOpenAPIDefinitions
}

func (b *AdvisorAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			switch a.GetResource() {
			// Custom authorizer can be registered here
			}
			// Default case, only allow admins
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			isAdmin := user.GetIsGrafanaAdmin()
			if isAdmin {
				return authorizer.DecisionAllow, "", nil
			}
			return authorizer.DecisionDeny, "", err
		})
}
