package collections

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	collections "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/collections/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	datasourcesClient "github.com/grafana/grafana/pkg/services/datasources/service/client"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var (
	_ builder.APIGroupBuilder    = (*APIBuilder)(nil)
	_ builder.APIGroupMutation   = (*APIBuilder)(nil)
	_ builder.APIGroupValidation = (*APIBuilder)(nil)
)

type APIBuilder struct {
	authorizer                authorizer.Authorizer
	legacyStars               *legacy.DashboardStarsStorage
	datasourceStacksValidator builder.APIGroupValidation
}

func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db db.DB,
	stars star.Service,
	users user.Service,
	apiregistration builder.APIRegistrar,
	dsConnClientFactory datasourcesClient.DataSourceConnectionClientFactory,
	restConfigProvider apiserver.RestConfigProvider,
) *APIBuilder {
	// Requires development settings and clearly experimental
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil
	}

	dsConnClient := dsConnClientFactory(restConfigProvider)

	sql := legacy.NewLegacySQL(legacysql.NewDatabaseProvider(db))
	builder := &APIBuilder{
		datasourceStacksValidator: GetDatasourceStacksValidator(dsConnClient),
		authorizer: &utils.AuthorizeFromName{
			Resource: map[string][]utils.ResourceOwner{
				"stars":       {utils.UserResourceOwner},
				"datasources": {utils.UserResourceOwner},
			},
		},
	}

	namespacer := request.GetNamespaceMapper(cfg)
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
	return collections.GroupVersion
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := collections.GroupVersion
	err := collections.AddToScheme(scheme)
	if err != nil {
		return err
	}

	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}

	// Configure Stars Dual writer
	starsResource := collections.StarsResourceInfo
	var stars grafanarest.Storage
	stars, err := grafanaregistry.NewRegistryStore(opts.Scheme, starsResource, opts.OptsGetter)
	if err != nil {
		return err
	}
	stars = &starStorage{Storage: stars} // wrap List so we only return one value
	if b.legacyStars != nil && opts.DualWriteBuilder != nil {
		stars, err = opts.DualWriteBuilder(starsResource.GroupResource(), b.legacyStars, stars)
		if err != nil {
			return err
		}
	}
	storage[starsResource.StoragePath()] = stars
	storage[starsResource.StoragePath("update")] = &starsREST{store: stars}

	// no need for dual writer for a kind that does not exist in the legacy database
	resourceInfo := collections.DatasourceStacksResourceInfo
	datasourcesStorage, err := grafanaregistry.NewRegistryStore(opts.Scheme, resourceInfo, opts.OptsGetter)
	storage[resourceInfo.StoragePath()] = datasourcesStorage

	apiGroupInfo.VersionedResourcesStorageMap[collections.APIVersion] = storage
	return nil
}

func (b *APIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	if a.GetKind().Group == collections.DatasourceStacksResourceInfo.GroupResource().Group {
		return b.datasourceStacksValidator.Validate(ctx, a, o)
	}
	return nil
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {

	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			if attr.GetResource() == "stars" {
				return b.authorizer.Authorize(ctx, attr)
			}

			// datasources auth branch starts
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}
			// require a user
			_, err = identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			// TODO make the auth more restrictive
			return authorizer.DecisionAllow, "", nil

		})
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return collections.GetOpenAPIDefinitions
}

func (b *APIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana collections"

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
