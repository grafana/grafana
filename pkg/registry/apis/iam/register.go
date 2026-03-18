package iam

import (
	"context"
	"fmt"
	"maps"
	"strings"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	legacyiamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	iamauthorizer "github.com/grafana/grafana/pkg/registry/apis/iam/authorizer"
	"github.com/grafana/grafana/pkg/registry/apis/iam/externalgroupmapping"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission"
	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccount"
	"github.com/grafana/grafana/pkg/registry/apis/iam/sso"
	"github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/registry/apis/iam/teambinding"
	"github.com/grafana/grafana/pkg/registry/apis/iam/user"
	"github.com/grafana/grafana/pkg/registry/fieldselectors"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	gfauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	teamservice "github.com/grafana/grafana/pkg/services/team"
	legacyuser "github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const MaxConcurrentZanzanaWrites = 20

func RegisterAPIService(
	cfg *setting.Cfg,
	cfgProvider configprovider.ConfigProvider,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	ssoService ssosettings.Service,
	sql db.DB,
	ac accesscontrol.AccessControl,
	accessClient types.AccessClient,
	zClient zanzana.Client,
	reg prometheus.Registerer,
	roleApiInstaller RoleApiInstaller,
	globalRoleApiInstaller GlobalRoleApiInstaller,
	teamLBACApiInstaller TeamLBACApiInstaller,
	externalGroupMappingApiInstaller ExternalGroupMappingApiInstaller,
	tracing *tracing.TracingService,
	roleBindingsStorage RoleBindingStorageBackend,
	teamGroupsHandlerImpl externalgroupmapping.TeamGroupsHandler,
	externalGroupMappingSearchHandler externalgroupmapping.SearchHandler,
	dual dualwrite.Service,
	unified resource.ResourceClient,
	orgService org.Service,
	userService legacyuser.Service,
	teamService teamservice.Service,
	restConfig apiserver.RestConfigProvider,
) (*IdentityAccessManagementAPIBuilder, error) {
	dbProvider := legacysql.NewDatabaseProvider(sql)
	store := legacy.NewLegacySQLStores(dbProvider)
	legacyAccessClient := newLegacyAccessClient(ac, store)
	authorizer := newIAMAuthorizer(accessClient, legacyAccessClient, roleApiInstaller, globalRoleApiInstaller, teamLBACApiInstaller, externalGroupMappingApiInstaller)
	registerMetrics(reg)

	rpStorage := resourcepermission.ProvideStorageBackend(dbProvider)

	// When resourcepermissions are in Mode5 (unistore only), search must error; pass nil backend so the handler returns that error.
	resourcePermsSearchBackend := resource.StorageBackend(rpStorage)
	if cfg != nil {
		if resCfg, ok := cfg.UnifiedStorage[iamv0.ResourcePermissionInfo.GroupResource().String()]; ok && resCfg.DualWriterMode == grafanarest.Mode5 {
			resourcePermsSearchBackend = nil
		}
	}

	resourceParentProvider := iamauthorizer.NewApiParentProvider(
		iamauthorizer.NewLocalConfigProvider(restConfig.GetRestConfig),
		iamauthorizer.Versions,
	)

	var resourcePermsSearchAuthorizer *iamauthorizer.ResourcePermissionsAuthorizer
	if resourcePermsSearchBackend != nil {
		resourcePermsSearchAuthorizer = iamauthorizer.NewResourcePermissionsAuthorizer(accessClient, resourceParentProvider)
	}

	builder := &IdentityAccessManagementAPIBuilder{
		store:                             store,
		userLegacyStore:                   user.NewLegacyStore(store, accessClient, tracing),
		saLegacyStore:                     serviceaccount.NewLegacyStore(store, accessClient, tracing),
		legacyTeamStore:                   team.NewLegacyStore(store, accessClient, tracing),
		teamBindingLegacyStore:            teambinding.NewLegacyBindingStore(store, tracing),
		ssoLegacyStore:                    sso.NewLegacyStore(ssoService, tracing),
		roleApiInstaller:                  roleApiInstaller,
		globalRoleApiInstaller:            globalRoleApiInstaller,
		teamLBACApiInstaller:              teamLBACApiInstaller,
		externalGroupMappingApiInstaller:  externalGroupMappingApiInstaller,
		resourcePermissionsStorage:        rpStorage,
		roleBindingsStorage:               roleBindingsStorage,
		teamGroupsHandler:                 teamGroupsHandlerImpl,
		externalGroupMappingSearchHandler: externalGroupMappingSearchHandler,
		sso:                               ssoService,
		resourceParentProvider:            resourceParentProvider,
		authorizer:                        authorizer,
		legacyAccessClient:                legacyAccessClient,
		accessClient:                      accessClient,
		ac:                                ac,
		roleConfigProvider:                restConfig.GetRestConfig,
		zClient:                           zClient,
		zTickets:                          make(chan bool, MaxConcurrentZanzanaWrites),
		display:                           user.NewLegacyDisplayREST(store),
		reg:                               reg,
		logger:                            log.New("iam.apis"),
		features:                          features,
		dual:                              dual,
		unified:                           unified,
		userSearchClient: resource.NewSearchClient(dualwrite.NewSearchAdapter(dual), iamv0.UserResourceInfo.GroupResource(),
			unified, user.NewUserLegacySearchClient(orgService, tracing, cfg), features),
		teamSearch:                       NewTeamSearchHandler(tracing, dual, team.NewLegacyTeamSearchClient(teamService, tracing), unified, features, accessClient),
		resourcePermissionsSearchHandler: newResourcePermissionsSearchHandler(resourcePermsSearchBackend, resourcePermsSearchAuthorizer),
		tracing:                          tracing,
		cfgProvider:                      cfgProvider,
		apiConfig: Config{
			SingleOrganization: cfg.RBAC.SingleOrganization,
		},
	}
	builder.userSearchHandler = user.NewSearchHandler(tracing, builder.userSearchClient, features, cfg, accessClient)

	apiregistration.RegisterAPI(builder)

	return builder, nil
}

func NewAPIService(
	accessClient types.AccessClient,
	dbProvider legacysql.LegacyDatabaseProvider,
	roleBindingsStorage RoleBindingStorageBackend,
	roleApiInstaller RoleApiInstaller,
	globalRoleApiInstaller GlobalRoleApiInstaller,
	teamLBACApiInstaller TeamLBACApiInstaller,
	features featuremgmt.FeatureToggles,
	zClient zanzana.Client,
	reg prometheus.Registerer,
	tokenExchanger authn.TokenExchanger,
	authorizerDialConfigs map[schema.GroupResource]iamauthorizer.DialConfig,
	tracingService tracing.Tracer,
) *IdentityAccessManagementAPIBuilder {
	store := legacy.NewLegacySQLStores(dbProvider)
	resourcePermissionsStorage := resourcepermission.ProvideStorageBackend(dbProvider)
	registerMetrics(reg)

	globalRoleAuthorizer := globalRoleApiInstaller.GetAuthorizer()
	roleAuthorizer := roleApiInstaller.GetAuthorizer()
	teamLBACAuthorizer := teamLBACApiInstaller.GetAuthorizer()
	resourceAuthorizer := gfauthorizer.NewResourceAuthorizer(accessClient)

	resourceParentProvider := iamauthorizer.NewApiParentProvider(
		iamauthorizer.NewRemoteConfigProvider(authorizerDialConfigs, tokenExchanger),
		iamauthorizer.Versions,
	)

	return &IdentityAccessManagementAPIBuilder{
		store:                      store,
		userLegacyStore:            user.NewLegacyStore(store, accessClient, tracingService),
		teamBindingLegacyStore:     teambinding.NewLegacyBindingStore(store, tracingService),
		display:                    user.NewLegacyDisplayREST(store),
		tracing:                    tracingService,
		resourcePermissionsStorage: resourcePermissionsStorage,
		roleBindingsStorage:        roleBindingsStorage,
		logger:                     log.New("iam.apis"),
		features:                   features,
		accessClient:               accessClient,
		resourceParentProvider:     resourceParentProvider,
		zClient:                    zClient,
		zTickets:                   make(chan bool, MaxConcurrentZanzanaWrites),
		reg:                        reg,
		roleApiInstaller:           roleApiInstaller,
		globalRoleApiInstaller:     globalRoleApiInstaller,
		apiConfig:                  Config{SingleOrganization: true},
		teamLBACApiInstaller:       teamLBACApiInstaller,
		authorizer: authorizer.AuthorizerFunc(
			func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
				user, ok := types.AuthInfoFrom(ctx)
				if !ok {
					return authorizer.DecisionDeny, "no identity found", apierrors.NewUnauthorized("no identity found in context")
				}

				if a.GetResource() == "globalroles" {
					if user.GetIdentityType() != types.TypeAccessPolicy {
						return authorizer.DecisionDeny, "only access policy identities have access for now", nil
					}
					return globalRoleAuthorizer.Authorize(ctx, a)
				}

				// For now only authorize resourcepermissions resource
				if a.GetResource() == "resourcepermissions" {
					// Authorization is handled by the backend wrapper
					return authorizer.DecisionAllow, "", nil
				}

				if a.GetResource() == "teamlbacrules" {
					return teamLBACAuthorizer.Authorize(ctx, a)
				}

				if a.GetResource() == "roles" {
					if user.GetIdentityType() != types.TypeAccessPolicy {
						return authorizer.DecisionDeny, "only access policy identities have access for now", nil
					}
					return roleAuthorizer.Authorize(ctx, a)
				}

				if a.GetResource() == "rolebindings" {
					if user.GetIdentityType() != types.TypeAccessPolicy {
						return authorizer.DecisionDeny, "only access policy identities have access for now", nil
					}
					return resourceAuthorizer.Authorize(ctx, a)
				}

				if a.GetResource() == "teambindings" {
					if user.GetIdentityType() != types.TypeAccessPolicy {
						return authorizer.DecisionDeny, "only access policy identities have access for now", nil
					}
					return authorizer.DecisionAllow, "", nil
				}

				if a.GetResource() == "users" {
					if user.GetIdentityType() != types.TypeAccessPolicy {
						return authorizer.DecisionDeny, "only access policy identities have access for now", nil
					}
					return resourceAuthorizer.Authorize(ctx, a)
				}

				return authorizer.DecisionDeny, "access denied", nil
			}),
	}
}

func (b *IdentityAccessManagementAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return legacyiamv0.SchemeGroupVersion
}

func (b *IdentityAccessManagementAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	client := openfeature.NewDefaultClient()
	ctx, cancelFn := context.WithTimeout(context.Background(), time.Second*5)
	defer cancelFn()

	// Check if any of the AuthZ APIs are enabled
	enableRolesApi := client.Boolean(ctx, featuremgmt.FlagKubernetesAuthzRolesApi, false, openfeature.TransactionContext(ctx))
	enableRoleBindingsApi := client.Boolean(ctx, featuremgmt.FlagKubernetesAuthzRoleBindingsApi, false, openfeature.TransactionContext(ctx))
	enableGlobalRolesApi := client.Boolean(ctx, featuremgmt.FlagKubernetesAuthzGlobalRolesApi, false, openfeature.TransactionContext(ctx))
	enableTeamLBACRuleApi := client.Boolean(ctx, featuremgmt.FlagKubernetesAuthzTeamLBACRuleApi, false, openfeature.TransactionContext(ctx))

	if enableRolesApi || enableRoleBindingsApi {
		if err := iamv0.AddAuthZKnownTypes(scheme); err != nil {
			return err
		}
	}

	if enableGlobalRolesApi {
		if err := iamv0.AddGlobalRoleKnownTypes(scheme); err != nil {
			return err
		}
	}

	if enableTeamLBACRuleApi {
		if err := iamv0.AddTeamLBACRuleTypes(scheme); err != nil {
			return err
		}
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	if b.features.IsEnabledGlobally(featuremgmt.FlagKubernetesAuthzResourcePermissionApis) {
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

	client := openfeature.NewDefaultClient()
	ctx, cancelFn := context.WithTimeout(context.Background(), time.Second*5)
	defer cancelFn()

	//nolint:staticcheck // not yet migrated to OpenFeature
	enableZanzanaSync := b.features.IsEnabledGlobally(featuremgmt.FlagKubernetesAuthzZanzanaSync)

	enableRolesApi := client.Boolean(ctx, featuremgmt.FlagKubernetesAuthzRolesApi, false, openfeature.TransactionContext(ctx))
	enableRoleBindingsApi := client.Boolean(ctx, featuremgmt.FlagKubernetesAuthzRoleBindingsApi, false, openfeature.TransactionContext(ctx))
	enableGlobalRolesApi := client.Boolean(ctx, featuremgmt.FlagKubernetesAuthzGlobalRolesApi, false, openfeature.TransactionContext(ctx))
	enableTeamLBACRuleApi := client.Boolean(ctx, featuremgmt.FlagKubernetesAuthzTeamLBACRuleApi, false, openfeature.TransactionContext(ctx))
	enableTeamsApi := client.Boolean(ctx, featuremgmt.FlagKubernetesTeamsApi, false, openfeature.TransactionContext(ctx))
	enableUserApi := b.isSingleOrgSetup() && client.Boolean(ctx, featuremgmt.FlagKubernetesUsersApi, false, openfeature.TransactionContext(ctx))
	enableServiceAccountsApi := client.Boolean(ctx, featuremgmt.FlagKubernetesServiceAccountsApi, false, openfeature.TransactionContext(ctx))
	enableServiceAccountTokensApi := client.Boolean(ctx, featuremgmt.FlagKubernetesServiceAccountTokensApi, false, openfeature.TransactionContext(ctx))
	enableExternalGroupMappingsApi := client.Boolean(ctx, featuremgmt.FlagKubernetesExternalGroupMappingsApi, false, openfeature.TransactionContext(ctx))
	enableSsoSettingsApi := client.Boolean(ctx, featuremgmt.FlagKubernetesSsoSettingsApi, false, openfeature.TransactionContext(ctx))

	// teams + users must have shorter names because they are often used as part of another name
	opts.StorageOptsRegister(iamv0.TeamResourceInfo.GroupResource(), apistore.StorageOptions{
		MaximumNameLength: 80,
	})
	opts.StorageOptsRegister(iamv0.UserResourceInfo.GroupResource(), apistore.StorageOptions{
		MaximumNameLength: 80,
	})

	if enableTeamsApi {
		if err := b.UpdateTeamsAPIGroup(opts, storage, enableExternalGroupMappingsApi); err != nil {
			return err
		}
	}

	if enableTeamsApi {
		if err := b.UpdateTeamBindingsAPIGroup(opts, storage, enableZanzanaSync); err != nil {
			return err
		}
	}

	if enableUserApi {
		if err := b.UpdateUsersAPIGroup(opts, storage, enableZanzanaSync); err != nil {
			return err
		}
	}

	if enableServiceAccountsApi {
		if err := b.UpdateServiceAccountsAPIGroup(opts, storage, enableServiceAccountTokensApi); err != nil {
			return err
		}
	}

	// SSO settings apis
	if enableSsoSettingsApi && b.ssoLegacyStore != nil {
		ssoResource := legacyiamv0.SSOSettingResourceInfo
		storage[ssoResource.StoragePath()] = b.ssoLegacyStore
	}

	if enableExternalGroupMappingsApi {
		if err := b.externalGroupMappingApiInstaller.RegisterStorage(apiGroupInfo, &opts, storage); err != nil {
			return err
		}
	}

	if enableRolesApi {
		// Role registration is delegated to the RoleApiInstaller
		if err := b.roleApiInstaller.RegisterStorage(apiGroupInfo, &opts, storage); err != nil {
			return err
		}
	}

	if enableGlobalRolesApi {
		if err := b.globalRoleApiInstaller.RegisterStorage(apiGroupInfo, &opts, storage); err != nil {
			return err
		}
	}

	if enableTeamLBACRuleApi {
		// TeamLBACRule registration is delegated to the TeamLBACApiInstaller
		if err := b.teamLBACApiInstaller.RegisterStorage(apiGroupInfo, &opts, storage); err != nil {
			return err
		}
	}

	if enableRoleBindingsApi {
		if err := b.UpdateRoleBindingsAPIGroup(apiGroupInfo, opts, storage, enableZanzanaSync, enableRolesApi); err != nil {
			return err
		}
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	if b.features.IsEnabledGlobally(featuremgmt.FlagKubernetesAuthzResourcePermissionApis) {
		if err := b.UpdateResourcePermissionsAPIGroup(apiGroupInfo, opts, storage, enableZanzanaSync); err != nil {
			return err
		}
	}

	apiGroupInfo.VersionedResourcesStorageMap[legacyiamv0.VERSION] = storage
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) UpdateTeamsAPIGroup(opts builder.APIGroupOptions, storage map[string]rest.Storage, enableExternalGroupMappingsApi bool) error {
	teamResource := iamv0.TeamResourceInfo
	teamUniStore, err := grafanaregistry.NewRegistryStore(opts.Scheme, teamResource, opts.OptsGetter)
	if err != nil {
		return err
	}
	storage[teamResource.StoragePath()] = teamUniStore

	if b.legacyTeamStore != nil {
		dw, err := opts.DualWriteBuilder(teamResource.GroupResource(), b.legacyTeamStore, teamUniStore)
		if err != nil {
			return err
		}

		storage[teamResource.StoragePath()] = dw
	}

	if b.dual != nil && b.unified != nil {
		legacyTeamBindingSearchClient := teambinding.NewLegacyTeamBindingSearchClient(b.store, b.tracing)

		teamBindingSearchClient := resource.NewSearchClient(
			dualwrite.NewSearchAdapter(b.dual),
			iamv0.TeamBindingResourceInfo.GroupResource(),
			b.unified,
			legacyTeamBindingSearchClient,
			b.features,
		)

		storage[teamResource.StoragePath("members")] = team.NewTeamMembersREST(teamBindingSearchClient, b.tracing,
			b.features, b.accessClient)
	}

	if enableExternalGroupMappingsApi && b.teamGroupsHandler != nil {
		storage[teamResource.StoragePath("groups")] = b.teamGroupsHandler
	}

	return nil
}

func (b *IdentityAccessManagementAPIBuilder) UpdateTeamBindingsAPIGroup(opts builder.APIGroupOptions, storage map[string]rest.Storage, enableZanzanaSync bool) error {
	teamBindingResource := iamv0.TeamBindingResourceInfo

	selectableFieldsOpts := grafanaregistry.SelectableFieldsOptions{
		GetAttrs: fieldselectors.BuildGetAttrsFn(iamv0.TeamBindingKind()),
	}
	teamBindingUniStore, err := grafanaregistry.NewRegistryStoreWithSelectableFields(opts.Scheme,
		teamBindingResource, opts.OptsGetter, selectableFieldsOpts)
	if err != nil {
		return err
	}

	var teamBindingStore storewrapper.K8sStorage = teamBindingUniStore

	// Only teamBindingStore exposes the AfterCreate, AfterDelete, and BeginUpdate hooks
	if enableZanzanaSync {
		b.logger.Info("Enabling hooks for TeamBinding to sync to Zanzana")
		teamBindingUniStore.AfterCreate = b.AfterTeamBindingCreate
		teamBindingUniStore.AfterDelete = b.AfterTeamBindingDelete
		teamBindingUniStore.BeginUpdate = b.BeginTeamBindingUpdate
	}

	if b.teamBindingLegacyStore != nil {
		dw, err := opts.DualWriteBuilder(teamBindingResource.GroupResource(), b.teamBindingLegacyStore, teamBindingUniStore)
		if err != nil {
			return err
		}

		var ok bool
		teamBindingStore, ok = dw.(storewrapper.K8sStorage)
		if !ok {
			return fmt.Errorf("expected storewrapper.K8sStorage, got %T", dw)
		}
	}

	authzWrapper := storewrapper.New(teamBindingStore, iamauthorizer.NewTeamBindingAuthorizer(b.accessClient))
	storage[teamBindingResource.StoragePath()] = authzWrapper
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) UpdateUsersAPIGroup(opts builder.APIGroupOptions, storage map[string]rest.Storage, enableZanzanaSync bool) error {
	userResource := iamv0.UserResourceInfo

	userSelectableFieldsOpts := grafanaregistry.SelectableFieldsOptions{
		GetAttrs: fieldselectors.BuildGetAttrsFn(iamv0.UserKind()),
	}
	userUniStore, err := grafanaregistry.NewRegistryStoreWithSelectableFields(opts.Scheme, userResource, opts.OptsGetter, userSelectableFieldsOpts)
	if err != nil {
		return err
	}

	if enableZanzanaSync {
		b.logger.Info("Enabling hooks for User to sync basic role assignments to Zanzana")
		userUniStore.AfterCreate = b.AfterUserCreate
		userUniStore.BeginUpdate = b.BeginUserUpdate
		userUniStore.AfterDelete = b.AfterUserDelete
	}

	var userStore storewrapper.K8sStorage = userUniStore

	if b.userLegacyStore != nil {
		dw, err := opts.DualWriteBuilder(userResource.GroupResource(), b.userLegacyStore, userUniStore)
		if err != nil {
			return err
		}

		var ok bool
		userStore, ok = dw.(storewrapper.K8sStorage)
		if !ok {
			return fmt.Errorf("expected storewrapper.K8sStorage, got %T", dw)
		}
	}

	storage[userResource.StoragePath()] = storewrapper.New(userStore, user.NewStoreWrapper(b.cfgProvider), storewrapper.WithPreserveIdentity())

	if b.dual != nil && b.unified != nil {
		legacyTeamBindingSearchClient := teambinding.NewLegacyTeamBindingSearchClient(b.store, b.tracing)

		teamBindingSearchClient := resource.NewSearchClient(
			dualwrite.NewSearchAdapter(b.dual),
			iamv0.TeamBindingResourceInfo.GroupResource(),
			b.unified,
			legacyTeamBindingSearchClient,
			b.features,
		)

		storage[userResource.StoragePath("teams")] = user.NewUserTeamREST(teamBindingSearchClient, b.tracing, b.features)
	}

	return nil
}

func (b *IdentityAccessManagementAPIBuilder) UpdateServiceAccountsAPIGroup(opts builder.APIGroupOptions, storage map[string]rest.Storage, enableServiceAccountTokensApi bool) error {
	saResource := iamv0.ServiceAccountResourceInfo
	saUniStore, err := grafanaregistry.NewRegistryStore(opts.Scheme, saResource, opts.OptsGetter)
	if err != nil {
		return err
	}
	storage[saResource.StoragePath()] = saUniStore

	if b.saLegacyStore != nil {
		dw, err := opts.DualWriteBuilder(saResource.GroupResource(), b.saLegacyStore, saUniStore)
		if err != nil {
			return err
		}
		storage[saResource.StoragePath()] = dw
	}

	if enableServiceAccountTokensApi {
		storage[saResource.StoragePath("tokens")] = serviceaccount.NewLegacyTokenREST(b.store)
	}

	return nil
}

func (b *IdentityAccessManagementAPIBuilder) UpdateRoleBindingsAPIGroup(
	apiGroupInfo *genericapiserver.APIGroupInfo,
	opts builder.APIGroupOptions,
	storage map[string]rest.Storage,
	enableZanzanaSync bool,
	enableRolesApi bool,
) error {
	uniStore, err := grafanaregistry.NewRegistryStore(opts.Scheme, iamv0.RoleBindingInfo, opts.OptsGetter)
	if err != nil {
		return err
	}

	// write to zanzana on unified storage writes
	if enableZanzanaSync {
		b.logger.Info("Enabling hooks for RoleBinding to sync to Zanzana")
		uniStore.AfterCreate = b.AfterRoleBindingCreate
		uniStore.AfterDelete = b.AfterRoleBindingDelete
		uniStore.BeginUpdate = b.BeginRoleBindingUpdate
	}

	var roleBindingStore storewrapper.K8sStorage = uniStore

	if b.roleBindingsStorage != nil {
		legacyStore, err := NewLocalStore(iamv0.RoleBindingInfo, apiGroupInfo.Scheme, opts.OptsGetter, b.reg, b.accessClient, b.roleBindingsStorage, grafanaregistry.SelectableFieldsOptions{})
		if err != nil {
			return err
		}

		dw, err := opts.DualWriteBuilder(iamv0.RoleBindingInfo.GroupResource(), legacyStore, uniStore)
		if err != nil {
			return err
		}

		var ok bool
		roleBindingStore, ok = dw.(storewrapper.K8sStorage)
		if !ok {
			return fmt.Errorf("expected storewrapper.K8sStorage, got %T", dw)
		}
	}

	var rbAuthorizer storewrapper.ResourceStorageAuthorizer
	if enableRolesApi && b.ac != nil && b.roleConfigProvider != nil {
		validator := iamauthorizer.NewRolePermissionValidator(b.accessClient, b.ac)
		roleRefResolver := iamauthorizer.RoleRefResolverFromConfigProvider(b.roleConfigProvider)
		rbAuthorizer = iamauthorizer.NewRoleBindingAuthorizer(validator, roleRefResolver)
	} else {
		// roles API disabled, then deny bindings
		rbAuthorizer = iamauthorizer.NewDenyCustomRoleRefsAuthorizer()
	}
	storage[iamv0.RoleBindingInfo.StoragePath()] = storewrapper.New(roleBindingStore, rbAuthorizer)
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) UpdateResourcePermissionsAPIGroup(
	apiGroupInfo *genericapiserver.APIGroupInfo,
	opts builder.APIGroupOptions,
	storage map[string]rest.Storage,
	enableZanzanaSync bool,
) error {
	uniStore, err := grafanaregistry.NewRegistryStore(opts.Scheme, iamv0.ResourcePermissionInfo, opts.OptsGetter)
	if err != nil {
		return err
	}

	// trigger zanzana hooks on unistore writes
	if enableZanzanaSync {
		b.logger.Info("Enabling AfterCreate, BeginUpdate, and AfterDelete hooks for ResourcePermission to sync to Zanzana")
		uniStore.AfterCreate = b.AfterResourcePermissionCreate
		uniStore.BeginUpdate = b.BeginResourcePermissionUpdate
		uniStore.AfterDelete = b.AfterResourcePermissionDelete
	}

	var regStoreDW storewrapper.K8sStorage = uniStore

	if b.resourcePermissionsStorage != nil {
		legacyStore, err := NewLocalStore(iamv0.ResourcePermissionInfo, apiGroupInfo.Scheme, opts.OptsGetter, b.reg, b.accessClient, b.resourcePermissionsStorage, grafanaregistry.SelectableFieldsOptions{})
		if err != nil {
			return err
		}

		dw, err := opts.DualWriteBuilder(iamv0.ResourcePermissionInfo.GroupResource(), legacyStore, uniStore)
		if err != nil {
			return err
		}

		var ok bool
		regStoreDW, ok = dw.(storewrapper.K8sStorage)
		if !ok {
			return fmt.Errorf("expected storewrapper.K8sStorage, got %T", dw)
		}
	}

	authzWrapper := storewrapper.New(regStoreDW, iamauthorizer.NewResourcePermissionsAuthorizer(b.accessClient, b.resourceParentProvider))

	storage[iamv0.ResourcePermissionInfo.StoragePath()] = authzWrapper

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

	if oas.Paths != nil && oas.Paths.Paths != nil {
		pathsToUpdate := []string{
			"/apis/iam.grafana.app/v0alpha1/namespaces/{namespace}/teams/{name}/groups",
			"/apis/iam.grafana.app/v0alpha1/namespaces/{namespace}/teams/{name}/members",
			"/apis/iam.grafana.app/v0alpha1/namespaces/{namespace}/users/{name}/teams",
		}

		for _, path := range pathsToUpdate {
			if p, ok := oas.Paths.Paths[path]; ok {
				if p.Get != nil {
					p.Get.Parameters = append(p.Get.Parameters,
						&spec3.Parameter{
							ParameterProps: spec3.ParameterProps{
								Name:        "limit",
								In:          "query",
								Description: "number of results to return",
								Example:     30,
								Required:    false,
								Schema:      spec.Int64Property(),
							},
						},
						&spec3.Parameter{
							ParameterProps: spec3.ParameterProps{
								Name:        "page",
								In:          "query",
								Description: "page number (starting from 1)",
								Example:     1,
								Required:    false,
								Schema:      spec.Int64Property(),
							},
						},
						&spec3.Parameter{
							ParameterProps: spec3.ParameterProps{
								Name:        "offset",
								In:          "query",
								Description: "number of results to skip",
								Example:     0,
								Required:    false,
								Schema:      spec.Int64Property(),
							},
						},
					)
				}
			}
		}
	}

	return oas, nil
}

func (b *IdentityAccessManagementAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })

	client := openfeature.NewDefaultClient()
	ctx, cancelFn := context.WithTimeout(context.Background(), time.Second*5)
	defer cancelFn()

	enableTeamsApi := client.Boolean(ctx, featuremgmt.FlagKubernetesTeamsApi, false, openfeature.TransactionContext(ctx))
	enableUserApi := b.isSingleOrgSetup() && client.Boolean(ctx, featuremgmt.FlagKubernetesUsersApi, false, openfeature.TransactionContext(ctx))
	enableExternalGroupMappingsApi := client.Boolean(ctx, featuremgmt.FlagKubernetesExternalGroupMappingsApi, false, openfeature.TransactionContext(ctx))
	enableResourcePermissionsApi := client.Boolean(ctx, featuremgmt.FlagKubernetesAuthzResourcePermissionApis, false, openfeature.TransactionContext(ctx))

	searchRoutes := make([]*builder.APIRoutes, 0, 3)
	if enableUserApi && b.userSearchHandler != nil {
		searchRoutes = append(searchRoutes, b.userSearchHandler.GetAPIRoutes(defs))
	}

	if enableTeamsApi && b.teamSearch != nil {
		searchRoutes = append(searchRoutes, b.teamSearch.GetAPIRoutes(defs))
	}

	if enableResourcePermissionsApi && b.resourcePermissionsSearchHandler != nil {
		searchRoutes = append(searchRoutes, b.resourcePermissionsSearchHandler.GetAPIRoutes(defs))
	}

	if enableExternalGroupMappingsApi && b.externalGroupMappingSearchHandler != nil {
		searchRoutes = append(searchRoutes, b.externalGroupMappingSearchHandler.GetAPIRoutes(defs))
	}

	routes := make([]*builder.APIRoutes, 0, 1+len(searchRoutes))
	routes = append(routes, b.display.GetAPIRoutes(defs))
	routes = append(routes, searchRoutes...)
	return mergeAPIRoutes(routes...)
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
		return b.validateCreate(ctx, a)
	case admission.Update:
		return b.validateUpdate(ctx, a)
	case admission.Delete:
		return b.validateDelete(ctx, a)
	case admission.Connect:
		return b.validateConnect(ctx, a)
	}
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) validateCreate(ctx context.Context, a admission.Attributes) error {
	switch typedObj := a.GetObject().(type) {
	case *iamv0.User:
		return user.ValidateOnCreate(ctx, b.userSearchClient, typedObj)
	case *iamv0.ServiceAccount:
		return serviceaccount.ValidateOnCreate(ctx, typedObj)
	case *iamv0.Team:
		return team.ValidateOnCreate(ctx, typedObj)
	case *iamv0.TeamBinding:
		return teambinding.ValidateOnCreate(ctx, typedObj)
	case *iamv0.ResourcePermission:
		return resourcepermission.ValidateCreateAndUpdateInput(ctx, typedObj)
	case *iamv0.ExternalGroupMapping:
		return b.externalGroupMappingApiInstaller.ValidateOnCreate(ctx, typedObj)
	case *iamv0.Role:
		return b.roleApiInstaller.ValidateOnCreate(ctx, typedObj)
	case *iamv0.GlobalRole:
		return b.globalRoleApiInstaller.ValidateOnCreate(ctx, typedObj)
	case *iamv0.TeamLBACRule:
		return b.teamLBACApiInstaller.ValidateOnCreate(ctx, typedObj)
	}
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) validateUpdate(ctx context.Context, a admission.Attributes) error {
	oldObj := a.GetOldObject()
	switch typedObj := a.GetObject().(type) {
	case *iamv0.User:
		oldUserObj, ok := oldObj.(*iamv0.User)
		if !ok {
			return fmt.Errorf("expected old object to be a User, got %T", oldObj)
		}
		return user.ValidateOnUpdate(ctx, b.userSearchClient, oldUserObj, typedObj)
	case *iamv0.ResourcePermission:
		return resourcepermission.ValidateCreateAndUpdateInput(ctx, typedObj)
	case *iamv0.Team:
		oldTeamObj, ok := oldObj.(*iamv0.Team)
		if !ok {
			return fmt.Errorf("expected old object to be a Team, got %T", oldObj)
		}
		return team.ValidateOnUpdate(ctx, typedObj, oldTeamObj)
	case *iamv0.TeamBinding:
		oldTeamBindingObj, ok := oldObj.(*iamv0.TeamBinding)
		if !ok {
			return fmt.Errorf("expected old object to be a TeamBinding, got %T", oldObj)
		}
		return teambinding.ValidateOnUpdate(ctx, typedObj, oldTeamBindingObj)
	case *iamv0.Role:
		oldRoleObj, ok := oldObj.(*iamv0.Role)
		if !ok {
			return fmt.Errorf("expected old object to be a Role, got %T", oldObj)
		}
		return b.roleApiInstaller.ValidateOnUpdate(ctx, oldRoleObj, typedObj)
	case *iamv0.GlobalRole:
		oldGlobalRoleObj, ok := oldObj.(*iamv0.GlobalRole)
		if !ok {
			return fmt.Errorf("expected old object to be a GlobalRole, got %T", oldObj)
		}
		return b.globalRoleApiInstaller.ValidateOnUpdate(ctx, oldGlobalRoleObj, typedObj)
	case *iamv0.TeamLBACRule:
		oldTeamLBACRuleObj, ok := oldObj.(*iamv0.TeamLBACRule)
		if !ok {
			return fmt.Errorf("expected old object to be a TeamLBACRule, got %T", oldObj)
		}
		return b.teamLBACApiInstaller.ValidateOnUpdate(ctx, oldTeamLBACRuleObj, typedObj)
	}
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) validateDelete(ctx context.Context, a admission.Attributes) error {
	switch oldObj := a.GetOldObject().(type) {
	case *iamv0.Role:
		return b.roleApiInstaller.ValidateOnDelete(ctx, oldObj)
	case *iamv0.GlobalRole:
		return b.globalRoleApiInstaller.ValidateOnDelete(ctx, oldObj)
	case *iamv0.TeamLBACRule:
		if b.teamLBACApiInstaller != nil {
			return b.teamLBACApiInstaller.ValidateOnDelete(ctx, oldObj)
		}
		return nil
	}
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) validateConnect(ctx context.Context, a admission.Attributes) error {
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
			return user.MutateOnCreateAndUpdate(ctx, typedObj)
		case *iamv0.ServiceAccount:
			return serviceaccount.MutateOnCreate(ctx, typedObj)
		case *iamv0.Role:
			return b.roleApiInstaller.MutateOnCreate(ctx, typedObj)
		case *iamv0.GlobalRole:
			return b.globalRoleApiInstaller.MutateOnCreate(ctx, typedObj)
		}
	case admission.Update:
		switch typedObj := a.GetObject().(type) {
		case *iamv0.User:
			return user.MutateOnCreateAndUpdate(ctx, typedObj)
		case *iamv0.Role:
			oldObj, ok := a.GetOldObject().(*iamv0.Role)
			if !ok {
				return fmt.Errorf("old object is not a Role")
			}
			return b.roleApiInstaller.MutateOnUpdate(ctx, oldObj, typedObj)
		case *iamv0.GlobalRole:
			oldObj, ok := a.GetOldObject().(*iamv0.GlobalRole)
			if !ok {
				return fmt.Errorf("old object is not a GlobalRole")
			}
			return b.globalRoleApiInstaller.MutateOnUpdate(ctx, oldObj, typedObj)
		}
	case admission.Delete:
		switch oldObj := a.GetOldObject().(type) {
		case *iamv0.Role:
			return b.roleApiInstaller.MutateOnDelete(ctx, oldObj)
		case *iamv0.GlobalRole:
			return b.globalRoleApiInstaller.MutateOnDelete(ctx, oldObj)
		}
	case admission.Connect:
		switch typedObj := a.GetObject().(type) {
		case *iamv0.Role:
			return b.roleApiInstaller.MutateOnConnect(ctx, typedObj)
		case *iamv0.GlobalRole:
			return b.globalRoleApiInstaller.MutateOnConnect(ctx, typedObj)
		}
	}

	return nil
}

func NewLocalStore(resourceInfo utils.ResourceInfo, scheme *runtime.Scheme, defaultOptsGetter generic.RESTOptionsGetter,
	reg prometheus.Registerer, ac types.AccessClient, storageBackend resource.StorageBackend, selectableFieldsOpts grafanaregistry.SelectableFieldsOptions) (*registry.Store, error) {
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

	store, err := grafanaregistry.NewRegistryStoreWithSelectableFields(scheme, resourceInfo, optsGetter, selectableFieldsOpts)
	return store, err
}

func (b *IdentityAccessManagementAPIBuilder) isSingleOrgSetup() bool {
	return b.apiConfig.SingleOrganization
}

func newResourcePermissionsSearchHandler(backend resource.StorageBackend, authorizer *iamauthorizer.ResourcePermissionsAuthorizer) *resourcepermission.ResourcePermissionsSearchHandler {
	var sqlBackend *resourcepermission.ResourcePermSqlBackend
	if backend != nil {
		sqlBackend, _ = backend.(*resourcepermission.ResourcePermSqlBackend)
	}
	return resourcepermission.NewResourcePermissionsSearchHandler(sqlBackend, authorizer)
}

func mergeAPIRoutes(routes ...*builder.APIRoutes) *builder.APIRoutes {
	merged := &builder.APIRoutes{}
	for _, r := range routes {
		if r == nil {
			continue
		}
		merged.Root = append(merged.Root, r.Root...)
		merged.Namespace = append(merged.Namespace, r.Namespace...)
	}
	return merged
}
