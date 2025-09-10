package iam

import (
	"context"
	"fmt"
	"maps"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	legacyiamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission"
	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccount"
	"github.com/grafana/grafana/pkg/registry/apis/iam/sso"
	"github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/registry/apis/iam/user"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	gfauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	ssoService ssosettings.Service,
	sql db.DB,
	ac accesscontrol.AccessControl,
	accessClient types.AccessClient,
	reg prometheus.Registerer,
	coreRolesStorage CoreRoleStorageBackend,
	rolesStorage RoleStorageBackend,
) (*IdentityAccessManagementAPIBuilder, error) {
	dbProvider := legacysql.NewDatabaseProvider(sql)
	store := legacy.NewLegacySQLStores(dbProvider)
	legacyAccessClient := newLegacyAccessClient(ac, store)
	authorizer := newIAMAuthorizer(accessClient, legacyAccessClient)

	builder := &IdentityAccessManagementAPIBuilder{
		store:                        store,
		coreRolesStorage:             coreRolesStorage,
		rolesStorage:                 rolesStorage,
		resourcePermissionsStorage:   resourcepermission.ProvideStorageBackend(dbProvider),
		sso:                          ssoService,
		authorizer:                   authorizer,
		legacyAccessClient:           legacyAccessClient,
		accessClient:                 accessClient,
		display:                      user.NewLegacyDisplayREST(store),
		reg:                          reg,
		enableAuthZApis:              features.IsEnabledGlobally(featuremgmt.FlagKubernetesAuthzApis),
		enableResourcePermissionApis: features.IsEnabledGlobally(featuremgmt.FlagKubernetesAuthzResourcePermissionApis),
		enableAuthnMutation:          features.IsEnabledGlobally(featuremgmt.FlagKubernetesAuthnMutation),
		enableDualWriter:             true,
	}
	apiregistration.RegisterAPI(builder)

	return builder, nil
}

func NewAPIService(
	accessClient types.AccessClient,
	store legacy.LegacyIdentityStore,
	resourcePermissionsStorage resource.StorageBackend,
) *IdentityAccessManagementAPIBuilder {
	resourceAuthorizer := gfauthorizer.NewResourceAuthorizer(accessClient)
	return &IdentityAccessManagementAPIBuilder{
		store:                        store,
		display:                      user.NewLegacyDisplayREST(store),
		resourcePermissionsStorage:   resourcePermissionsStorage,
		enableResourcePermissionApis: true,
		authorizer: authorizer.AuthorizerFunc(
			func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
				// For now only authorize resourcepermissions resource
				if a.GetResource() == "resourcepermissions" {
					return resourceAuthorizer.Authorize(ctx, a)
				}

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
	return legacyiamv0.SchemeGroupVersion
}

func (b *IdentityAccessManagementAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	if b.enableAuthZApis {
		if err := iamv0.AddAuthZKnownTypes(scheme); err != nil {
			return err
		}
	}
	if b.enableResourcePermissionApis {
		if err := iamv0.AddResourcePermissionKnownTypes(scheme, iamv0.SchemeGroupVersion); err != nil {
			return err
		}
	}

	if err := iamv0.AddAuthNKnownTypes(scheme); err != nil {
		return err
	}

	legacyiamv0.AddKnownTypes(scheme, legacyiamv0.VERSION)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	// "no kind is registered for the type"
	legacyiamv0.AddKnownTypes(scheme, runtime.APIVersionInternal)

	metav1.AddToGroupVersion(scheme, iamv0.SchemeGroupVersion)
	return scheme.SetVersionPriority(iamv0.SchemeGroupVersion)
}

func (b *IdentityAccessManagementAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}

func (b *IdentityAccessManagementAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}

	teamResource := iamv0.TeamResourceInfo
	storage[teamResource.StoragePath()] = team.NewLegacyStore(b.store, b.legacyAccessClient)
	storage[teamResource.StoragePath("members")] = team.NewLegacyTeamMemberREST(b.store)

	teamBindingResource := iamv0.TeamBindingResourceInfo
	storage[teamBindingResource.StoragePath()] = team.NewLegacyBindingStore(b.store)

	// User store registration
	userResource := iamv0.UserResourceInfo
	legacyStore := user.NewLegacyStore(b.store, b.legacyAccessClient, b.enableAuthnMutation)
	storage[userResource.StoragePath()] = legacyStore

	if b.enableDualWriter {
		store, err := grafanaregistry.NewRegistryStore(opts.Scheme, userResource, opts.OptsGetter)
		if err != nil {
			return err
		}

		dw, err := opts.DualWriteBuilder(userResource.GroupResource(), legacyStore, store)
		if err != nil {
			return err
		}

		storage[userResource.StoragePath()] = dw
	}

	storage[userResource.StoragePath("teams")] = user.NewLegacyTeamMemberREST(b.store)

	// Service Accounts store registration
	serviceAccountResource := iamv0.ServiceAccountResourceInfo
	saLegacyStore := serviceaccount.NewLegacyStore(b.store, b.legacyAccessClient, b.enableAuthnMutation)
	storage[serviceAccountResource.StoragePath()] = saLegacyStore

	if b.enableDualWriter {
		store, err := grafanaregistry.NewRegistryStore(opts.Scheme, serviceAccountResource, opts.OptsGetter)
		if err != nil {
			return err
		}

		dw, err := opts.DualWriteBuilder(serviceAccountResource.GroupResource(), saLegacyStore, store)
		if err != nil {
			return err
		}

		storage[serviceAccountResource.StoragePath()] = dw
	}

	storage[serviceAccountResource.StoragePath("tokens")] = serviceaccount.NewLegacyTokenREST(b.store)

	if b.sso != nil {
		ssoResource := legacyiamv0.SSOSettingResourceInfo
		storage[ssoResource.StoragePath()] = sso.NewLegacyStore(b.sso)
	}

	if b.enableAuthZApis {
		// v0alpha1
		coreRoleStore, err := NewLocalStore(iamv0.CoreRoleInfo, apiGroupInfo.Scheme, opts.OptsGetter, b.reg, b.accessClient, b.coreRolesStorage)
		if err != nil {
			return err
		}
		storage[iamv0.CoreRoleInfo.StoragePath()] = coreRoleStore

		roleStore, err := NewLocalStore(iamv0.RoleInfo, apiGroupInfo.Scheme, opts.OptsGetter, b.reg, b.accessClient, b.rolesStorage)
		if err != nil {
			return err
		}
		storage[iamv0.RoleInfo.StoragePath()] = roleStore
	}

	if b.enableResourcePermissionApis {
		resourcePermissionStore, err := NewLocalStore(iamv0.ResourcePermissionInfo, apiGroupInfo.Scheme, opts.OptsGetter, b.reg, b.accessClient, b.resourcePermissionsStorage)
		if err != nil {
			return err
		}
		storage[iamv0.ResourcePermissionInfo.StoragePath()] = resourcePermissionStore
	}

	apiGroupInfo.VersionedResourcesStorageMap[legacyiamv0.VERSION] = storage
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(rc common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		dst := legacyiamv0.GetOpenAPIDefinitions(rc)
		maps.Copy(dst, iamv0.GetOpenAPIDefinitions(rc))

		return dst
	}
}

func (b *IdentityAccessManagementAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Identity and Access Management"

	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	defsBase := "github.com/grafana/grafana/pkg/apis/iam/v0alpha1."

	// Add missing schemas
	for k, v := range defs {
		clean := strings.Replace(k, defsBase, "com.github.grafana.grafana.pkg.apis.iam.v0alpha1.", 1)
		if oas.Components.Schemas[clean] == nil {
			oas.Components.Schemas[clean] = &v.Schema
		}
	}
	compBase := "com.github.grafana.grafana.pkg.apis.iam.v0alpha1."
	schema := oas.Components.Schemas[compBase+"DisplayList"].Properties["display"]
	schema.Items = &spec.SchemaOrArray{
		Schema: &spec.Schema{
			SchemaProps: spec.SchemaProps{
				AllOf: []spec.Schema{
					{
						SchemaProps: spec.SchemaProps{
							Ref: spec.MustCreateRef("#/components/schemas/" + compBase + "Display"),
						},
					},
				},
			},
		},
	}
	oas.Components.Schemas[compBase+"DisplayList"].Properties["display"] = schema
	oas.Components.Schemas[compBase+"DisplayList"].Properties["metadata"] = spec.Schema{
		SchemaProps: spec.SchemaProps{
			AllOf: []spec.Schema{
				{
					SchemaProps: spec.SchemaProps{
						Ref: spec.MustCreateRef("#/components/schemas/io.k8s.apimachinery.pkg.apis.meta.v1.ListMeta"),
					},
				},
			}},
	}
	oas.Components.Schemas[compBase+"Display"].Properties["identity"] = spec.Schema{
		SchemaProps: spec.SchemaProps{
			AllOf: []spec.Schema{
				{
					SchemaProps: spec.SchemaProps{
						Ref: spec.MustCreateRef("#/components/schemas/" + compBase + "IdentityRef"),
					},
				},
			}},
	}
	return oas, nil
}

func (b *IdentityAccessManagementAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return b.display.GetAPIRoutes(defs)
}

func (b *IdentityAccessManagementAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.authorizer
}

// Validate implements builder.APIGroupValidation.
// TODO: Move this to the ValidateFunc of the user resource after moving the APIs to use the app-platofrm-sdk.
// TODO: https://github.com/grafana/grafana/blob/main/apps/playlist/pkg/app/app.go#L62
func (b *IdentityAccessManagementAPIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	switch a.GetOperation() {
	case admission.Create:
		switch typedObj := a.GetObject().(type) {
		case *iamv0.User:
			return b.validateCreateUser(ctx, a, o)
		case *iamv0.ServiceAccount:
			return serviceaccount.ValidateOnCreate(ctx, typedObj)
		}
		return nil
	case admission.Update:
		return nil
	case admission.Delete:
		return nil
	case admission.Connect:
		return nil
	}

	return nil
}

func (b *IdentityAccessManagementAPIBuilder) validateCreateUser(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	userObj, ok := a.GetObject().(*iamv0.User)
	if !ok {
		return nil
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	// Temporary validation that the user is not trying to create a Grafana Admin without being a Grafana Admin.
	if userObj.Spec.GrafanaAdmin && !requester.GetIsGrafanaAdmin() {
		return apierrors.NewForbidden(iamv0.UserResourceInfo.GroupResource(),
			userObj.Name,
			fmt.Errorf("only grafana admins can create grafana admins"))
	}

	if userObj.Spec.Login == "" && userObj.Spec.Email == "" {
		return apierrors.NewBadRequest("user must have either login or email")
	}

	return nil
}

// Mutate implements builder.APIGroupMutation.
// TODO: Move this to the MutateFunc of the user resource after moving the APIs to use the app-platofrm-sdk.
// TODO: https://github.com/grafana/grafana/blob/main/apps/playlist/pkg/app/app.go#L62
func (b *IdentityAccessManagementAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	switch a.GetOperation() {
	case admission.Create:
		switch typedObj := a.GetObject().(type) {
		case *iamv0.User:
			return user.MutateOnCreate(ctx, typedObj)
		case *iamv0.ServiceAccount:
			return serviceaccount.MutateOnCreate(ctx, typedObj)
		}
		return nil
	case admission.Update:
		return nil
	case admission.Delete:
		return nil
	case admission.Connect:
		return nil
	}

	return nil
}

func NewLocalStore(resourceInfo utils.ResourceInfo, scheme *runtime.Scheme, defaultOptsGetter generic.RESTOptionsGetter,
	reg prometheus.Registerer, ac types.AccessClient, storageBackend resource.StorageBackend) (grafanarest.Storage, error) {
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      storageBackend,
		Reg:          reg,
		AccessClient: ac,
	})
	if err != nil {
		return nil, err
	}
	defaultOpts, err := defaultOptsGetter.GetRESTOptions(resourceInfo.GroupResource(), nil)
	if err != nil {
		return nil, err
	}

	client := resource.NewLocalResourceClient(server)
	optsGetter := apistore.NewRESTOptionsGetterForClient(client, nil, defaultOpts.StorageConfig.Config, nil)

	store, err := grafanaregistry.NewRegistryStore(scheme, resourceInfo, optsGetter)
	return store, err
}
