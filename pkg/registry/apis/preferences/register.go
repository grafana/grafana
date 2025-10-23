package preferences

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var (
	_ builder.APIGroupBuilder  = (*APIBuilder)(nil)
	_ builder.APIGroupMutation = (*APIBuilder)(nil)
)

type APIBuilder struct {
	authorizer  authorizer.Authorizer
	legacyStars *legacy.DashboardStarsStorage
	legacyPrefs rest.Storage

	merger *merger // joins all preferences
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
	//nolint:staticcheck
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil
	}

	sql := legacy.NewLegacySQL(legacysql.NewDatabaseProvider(db))
	builder := &APIBuilder{
		merger: newMerger(cfg, sql),
		authorizer: &authorizeFromName{
			oknames: []string{"merged"},
			teams:   sql, // should be from the IAM service
			resource: map[string][]utils.ResourceOwner{
				"stars": {utils.UserResourceOwner},
				"preferences": {
					utils.NamespaceResourceOwner,
					utils.TeamResourceOwner,
					utils.UserResourceOwner,
				},
			},
		},
	}

	namespacer := request.GetNamespaceMapper(cfg)
	if prefs != nil {
		builder.legacyPrefs = legacy.NewPreferencesStorage(prefs, namespacer, sql)
	}
	if stars != nil {
		builder.legacyStars = legacy.NewDashboardStarsStorage(stars, users, namespacer, sql)
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
	resource := preferences.StarsResourceInfo
	var stars grafanarest.Storage
	stars, err := grafanaregistry.NewRegistryStore(opts.Scheme, resource, opts.OptsGetter)
	if err != nil {
		return err
	}
	stars = &starStorage{Storage: stars} // wrap List so we only return one value
	if b.legacyStars != nil && opts.DualWriteBuilder != nil {
		stars, err = opts.DualWriteBuilder(resource.GroupResource(), b.legacyStars, stars)
		if err != nil {
			return err
		}
	}
	storage[resource.StoragePath()] = stars
	storage[resource.StoragePath("update")] = &starsREST{store: stars}

	// Configure Preferences
	prefs := preferences.PreferencesResourceInfo
	storage[prefs.StoragePath()] = b.legacyPrefs

	apiGroupInfo.VersionedResourcesStorageMap[preferences.APIVersion] = storage
	return nil
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.authorizer
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return preferences.GetOpenAPIDefinitions
}

func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return b.merger.GetAPIRoutes(defs)
}

func (b *APIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana preferences"

	root := "/apis/" + b.GetGroupVersion().String() + "/"
	updateKey := root + "namespaces/{namespace}/stars/{name}/update"
	delete(oas.Paths.Paths, updateKey)

	// Add the group/kind/id properties to the path
	stars, ok := oas.Paths.Paths[updateKey+"/{path}"]
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

	delete(oas.Paths.Paths, updateKey+"/{path}")
	oas.Paths.Paths[updateKey+"/{group}/{kind}/{id}"] = stars

	return oas, nil
}
