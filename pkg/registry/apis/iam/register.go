package iam

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	identityv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccount"
	"github.com/grafana/grafana/pkg/registry/apis/iam/sso"
	"github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/registry/apis/iam/user"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
)

var _ builder.APIGroupBuilder = (*IdentityAccessManagementAPIBuilder)(nil)

// This is used just so wire has something unique to return
type IdentityAccessManagementAPIBuilder struct {
	Store      legacy.LegacyIdentityStore
	SSOService ssosettings.Service
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	ssoService ssosettings.Service,
	sql db.DB,
) (*IdentityAccessManagementAPIBuilder, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless opting into experimental apis
	}

	builder := &IdentityAccessManagementAPIBuilder{
		Store:      legacy.NewLegacySQLStores(legacysql.NewDatabaseProvider(sql)),
		SSOService: ssoService,
	}
	apiregistration.RegisterAPI(builder)

	return builder, nil
}

func (b *IdentityAccessManagementAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return identityv0.SchemeGroupVersion
}

func (b *IdentityAccessManagementAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	identityv0.AddKnownTypes(scheme, identityv0.VERSION)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	// "no kind is registered for the type"
	identityv0.AddKnownTypes(scheme, runtime.APIVersionInternal)

	metav1.AddToGroupVersion(scheme, identityv0.SchemeGroupVersion)
	return scheme.SetVersionPriority(identityv0.SchemeGroupVersion)
}

func (b *IdentityAccessManagementAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
	dualWriteBuilder grafanarest.DualWriteBuilder,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(identityv0.GROUP, scheme, metav1.ParameterCodec, codecs)
	storage := map[string]rest.Storage{}

	teamResource := identityv0.TeamResourceInfo
	storage[teamResource.StoragePath()] = team.NewLegacyStore(b.Store)
	storage[teamResource.StoragePath("members")] = team.NewLegacyTeamMemberREST(b.Store)

	teamBindingResource := identityv0.TeamBindingResourceInfo
	storage[teamBindingResource.StoragePath()] = team.NewLegacyBindingStore(b.Store)

	userResource := identityv0.UserResourceInfo
	storage[userResource.StoragePath()] = user.NewLegacyStore(b.Store)
	storage[userResource.StoragePath("teams")] = user.NewLegacyTeamMemberREST(b.Store)

	serviceaccountResource := identityv0.ServiceAccountResourceInfo
	storage[serviceaccountResource.StoragePath()] = serviceaccount.NewLegacyStore(b.Store)

	if b.SSOService != nil {
		ssoResource := identityv0.SSOSettingResourceInfo
		storage[ssoResource.StoragePath()] = sso.NewLegacyStore(b.SSOService)
	}

	// The display endpoint -- NOTE, this uses a rewrite hack to allow requests without a name parameter
	storage["display"] = user.NewLegacyDisplayREST(b.Store)

	apiGroupInfo.VersionedResourcesStorageMap[identityv0.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *IdentityAccessManagementAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return identityv0.GetOpenAPIDefinitions
}

func (b *IdentityAccessManagementAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	// no custom API routes
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	// TODO: handle authorization based in entity.
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "no identity found", err
			}
			if user.GetIsGrafanaAdmin() {
				return authorizer.DecisionAllow, "", nil
			}
			return authorizer.DecisionDeny, "only grafana admins have access for now", nil
		})
}
