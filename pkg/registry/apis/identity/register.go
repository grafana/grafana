package identity

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	identity "github.com/grafana/grafana/pkg/apimachinery/apis/identity/v0alpha1"
	identityapi "github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/identity/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ builder.APIGroupBuilder = (*IdentityAPIBuilder)(nil)

// This is used just so wire has something unique to return
type IdentityAPIBuilder struct {
	Store legacy.LegacyIdentityStore
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	// svcTeam team.Service,
	// svcUser user.Service,
	sql db.DB,
) (*IdentityAPIBuilder, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless opting into experimental apis
	}

	store, err := legacy.NewLegacySQLStores(func(context.Context) (db.DB, error) {
		return sql, nil
	})
	if err != nil {
		return nil, err
	}

	builder := &IdentityAPIBuilder{
		Store: store,
	}
	apiregistration.RegisterAPI(builder)
	return builder, nil
}

func (b *IdentityAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return identity.SchemeGroupVersion
}

func (b *IdentityAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	if err := identity.AddKnownTypes(scheme, identity.VERSION); err != nil {
		return err
	}

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	if err := identity.AddKnownTypes(scheme, runtime.APIVersionInternal); err != nil {
		return err
	}

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, identity.SchemeGroupVersion)
	return scheme.SetVersionPriority(identity.SchemeGroupVersion)
}

func (b *IdentityAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
	dualWriteBuilder grafanarest.DualWriteBuilder,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(identity.GROUP, scheme, metav1.ParameterCodec, codecs)
	storage := map[string]rest.Storage{}

	team := identity.TeamResourceInfo
	teamStore := &legacyTeamStorage{
		service:        b.Store,
		resourceInfo:   team,
		tableConverter: team.TableConverter(),
	}
	storage[team.StoragePath()] = teamStore

	user := identity.UserResourceInfo
	userStore := &legacyUserStorage{
		service:        b.Store,
		resourceInfo:   user,
		tableConverter: user.TableConverter(),
	}
	storage[user.StoragePath()] = userStore
	storage[user.StoragePath("teams")] = newUserTeamsREST(b.Store)

	sa := identity.ServiceAccountResourceInfo
	saStore := &legacyServiceAccountStorage{
		service:        b.Store,
		resourceInfo:   sa,
		tableConverter: sa.TableConverter(),
	}
	storage[sa.StoragePath()] = saStore

	// The display endpoint -- NOTE, this uses a rewrite hack to allow requests without a name parameter
	storage["display"] = newDisplayREST(b.Store)

	apiGroupInfo.VersionedResourcesStorageMap[identity.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *IdentityAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return identity.GetOpenAPIDefinitions
}

func (b *IdentityAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil // no custom API routes
}

func (b *IdentityAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			user, err := identityapi.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "no identity found", err
			}
			if user.GetIsGrafanaAdmin() {
				return authorizer.DecisionAllow, "", nil
			}
			return authorizer.DecisionDeny, "only grafana admins have access for now", nil
		})
}
