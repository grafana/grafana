package preferences

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var _ builder.APIGroupBuilder = (*APIBuilder)(nil)

type APIBuilder struct {
	namespacer request.NamespaceMapper
	sql        *legacy.LegacySQL

	stars      star.Service
	prefs      pref.Service
	users      user.Service
	calculator *calculator // joins all preferences
}

func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db db.DB,
	prefs pref.Service,
	stars star.Service,
	users user.Service,
	apiregistration builder.APIRegistrar,
) *APIBuilder {
	// Requires development settings and clearly experimental
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil
	}

	sql := legacy.NewLegacySQL(legacysql.NewDatabaseProvider(db))
	builder := &APIBuilder{
		prefs:      prefs, // for writing
		stars:      stars, // for writing
		users:      users, // for writing
		namespacer: request.GetNamespaceMapper(cfg),
		sql:        sql,
		calculator: newCalculator(cfg, sql),
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

// AllowedV0Alpha1Resources implements builder.APIGroupBuilder.
func (b *APIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return preferences.GroupVersion
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := preferences.GroupVersion
	err := preferences.AddToScheme(scheme)
	if err != nil {
		return err
	}

	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}

	// Configure Stars Dual writer
	stars := preferences.StarsResourceInfo
	unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, stars, opts.OptsGetter)
	if err != nil {
		return err
	}
	storage[stars.StoragePath()] = unified
	if b.stars != nil {
		legacy := legacy.NewDashboardStarsStorage(b.stars, b.users, b.namespacer, b.sql)
		storage[stars.StoragePath()], err = opts.DualWriteBuilder(stars.GroupResource(), legacy, unified)
		if err != nil {
			return err
		}
		storage[stars.StoragePath("write")] = &starsREST{
			store: legacy, // TODO, only supports legacy right now
		}
	}

	// Configure Preferences
	prefs := preferences.PreferencesResourceInfo
	storage[prefs.StoragePath()] = legacy.NewPreferencesStorage(b.namespacer, b.sql)

	apiGroupInfo.VersionedResourcesStorageMap[preferences.APIVersion] = storage
	return nil
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return preferences.GetOpenAPIDefinitions
}

func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return b.calculator.GetAPIRoutes(defs)
}

func (b *APIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana preferences"

	root := "/apis/" + b.GetGroupVersion().String() + "/"
	writeKey := root + "namespaces/{namespace}/stars/{name}/write"
	delete(oas.Paths.Paths, writeKey)

	// Add the group/kind/id properties to the path
	stars, ok := oas.Paths.Paths[writeKey+"/{path}"]
	if !ok || stars == nil {
		return nil, fmt.Errorf("unable to find write path")
	}
	stars.Parameters = []*spec3.Parameter{
		stars.Parameters[0], // name
		stars.Parameters[1], // namespace
		{
			ParameterProps: spec3.ParameterProps{
				Name:        "group",
				In:          "path",
				Example:     "dashboard.grafana.app",
				Description: "API group for stared item",
				Schema:      spec.StringProperty(),
				Required:    true,
			},
		}, {
			ParameterProps: spec3.ParameterProps{
				Name:        "kind",
				In:          "path",
				Example:     "Dashboard",
				Description: "Kind for stared item",
				Schema:      spec.StringProperty(),
				Required:    true,
			},
		}, {
			ParameterProps: spec3.ParameterProps{
				Name:        "id",
				In:          "path",
				Example:     "",
				Description: "The k8s name for the selected item",
				Schema:      spec.StringProperty(),
				Required:    true,
			},
		},
	}
	stars.Put.Description = "Add a starred item"
	stars.Put.OperationId = "addStar"
	stars.Delete.Description = "Remove a starred item"
	stars.Delete.OperationId = "removeStar"

	delete(oas.Paths.Paths, writeKey+"/{path}")
	oas.Paths.Paths[writeKey+"/{group}/{kind}/{id}"] = stars

	return oas, nil
}
