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
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ builder.APIGroupBuilder = (*IdentityAPIBuilder)(nil)

// This is used just so wire has something unique to return
type IdentityAPIBuilder struct {
	svcTeam team.Service
	svcUser user.Service
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	svcTeam team.Service,
	svcUser user.Service,

) *IdentityAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	builder := &IdentityAPIBuilder{
		svcTeam: svcTeam,
		svcUser: svcUser,
	}
	apiregistration.RegisterAPI(builder)
	return builder
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
		service:        b.svcTeam,
		resourceInfo:   team,
		tableConverter: team.TableConverter(),
	}
	storage[team.StoragePath()] = teamStore

	user := identity.UserResourceInfo
	userStore := &legacyUserStorage{
		service:        b.svcUser,
		resourceInfo:   user,
		tableConverter: user.TableConverter(),
	}
	storage[user.StoragePath()] = userStore

	sa := identity.ServiceAccountResourceInfo
	saStore := &legacyServiceAccountStorage{
		service:        b.svcUser,
		resourceInfo:   sa,
		tableConverter: sa.TableConverter(),
	}
	storage[sa.StoragePath()] = saStore

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
