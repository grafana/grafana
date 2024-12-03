package iam

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccount"
	"github.com/grafana/grafana/pkg/registry/apis/iam/sso"
	"github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/registry/apis/iam/user"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var _ builder.APIGroupBuilder = (*IdentityAccessManagementAPIBuilder)(nil)

// This is used just so wire has something unique to return
type IdentityAccessManagementAPIBuilder struct {
	store        legacy.LegacyIdentityStore
	authorizer   authorizer.Authorizer
	accessClient authz.AccessClient

	// Not set for multi-tenant deployment for now
	sso ssosettings.Service
	ext APIExtender
}

func RegisterAPIService(
	apiregistration builder.APIRegistrar,
	ssoService ssosettings.Service,
	sql db.DB,
	ac accesscontrol.AccessControl,
	ext APIExtender,
) (*IdentityAccessManagementAPIBuilder, error) {
	store := legacy.NewLegacySQLStores(legacysql.NewDatabaseProvider(sql))
	authorizer, client := newLegacyAuthorizer(ac, store)

	builder := &IdentityAccessManagementAPIBuilder{
		store:        store,
		sso:          ssoService,
		authorizer:   authorizer,
		accessClient: client,
		ext:          ext,
	}
	apiregistration.RegisterAPI(builder)

	return builder, nil
}

func NewAPIService(store legacy.LegacyIdentityStore, ext APIExtender) *IdentityAccessManagementAPIBuilder {
	return &IdentityAccessManagementAPIBuilder{
		ext:   ext,
		store: store,
		authorizer: authorizer.AuthorizerFunc(
			func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
				user, err := identity.GetRequester(ctx)
				if err != nil {
					return authorizer.DecisionDeny, "no identity found", err
				}
				if user.GetIsGrafanaAdmin() {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "only grafana admins have access for now", nil
			}),
	}
}

func (b *IdentityAccessManagementAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return iamv0.SchemeGroupVersion
}

func (b *IdentityAccessManagementAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	iamv0.AddKnownTypes(scheme, iamv0.VERSION)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	// "no kind is registered for the type"
	iamv0.AddKnownTypes(scheme, runtime.APIVersionInternal)

	metav1.AddToGroupVersion(scheme, iamv0.SchemeGroupVersion)
	return scheme.SetVersionPriority(iamv0.SchemeGroupVersion)
}

func (b *IdentityAccessManagementAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, _ builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}

	teamResource := iamv0.TeamResourceInfo
	storage[teamResource.StoragePath()] = team.NewLegacyStore(b.store, b.accessClient)
	storage[teamResource.StoragePath("members")] = team.NewLegacyTeamMemberREST(b.store)

	teamBindingResource := iamv0.TeamBindingResourceInfo
	storage[teamBindingResource.StoragePath()] = team.NewLegacyBindingStore(b.store)

	userResource := iamv0.UserResourceInfo
	storage[userResource.StoragePath()] = user.NewLegacyStore(b.store, b.accessClient)
	storage[userResource.StoragePath("teams")] = user.NewLegacyTeamMemberREST(b.store)

	serviceAccountResource := iamv0.ServiceAccountResourceInfo
	storage[serviceAccountResource.StoragePath()] = serviceaccount.NewLegacyStore(b.store, b.accessClient)
	storage[serviceAccountResource.StoragePath("tokens")] = serviceaccount.NewLegacyTokenREST(b.store)

	if b.sso != nil {
		ssoResource := iamv0.SSOSettingResourceInfo
		storage[ssoResource.StoragePath()] = sso.NewLegacyStore(b.sso)
	}

	// The display endpoint -- NOTE, this uses a rewrite hack to allow requests without a name parameter
	storage["display"] = user.NewLegacyDisplayREST(b.store)

	apiGroupInfo.VersionedResourcesStorageMap[iamv0.VERSION] = storage
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return iamv0.GetOpenAPIDefinitions
}

func (b *IdentityAccessManagementAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	if b.ext != nil {
		return b.ext.GetAPIRoutes()
	}
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The application description
	oas.Info.Description = "Grafana Identity and Access Management"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, nil
}

func (b *IdentityAccessManagementAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.authorizer
}
