package preferences

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var _ builder.APIGroupBuilder = (*APIBuilder)(nil)

type APIBuilder struct {
	namespacer request.NamespaceMapper
	sql        *legacy.LegacySQL

	prefs      pref.Service
	calculator *calculator // joins all preferences
}

func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db db.DB,
	prefs pref.Service,
	apiregistration builder.APIRegistrar,
) *APIBuilder {
	// Requires development settings and clearly experimental
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil
	}

	sql := legacy.NewLegacySQL(legacysql.NewDatabaseProvider(db))
	builder := &APIBuilder{
		prefs:      prefs, // for writing
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

	stars := preferences.StarsResourceInfo
	storage[stars.StoragePath()] = legacy.NewStarsStorage(b.namespacer, b.sql)

	prefs := preferences.PreferencesResourceInfo
	// Unified storage
	// store, err := grafanaregistry.NewRegistryStore(opts.Scheme, resourceInfo, opts.OptsGetter)
	// if err != nil {
	// 	return err
	// }
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
