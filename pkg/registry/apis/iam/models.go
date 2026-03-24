package iam

import (
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/configprovider"
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
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ builder.APIGroupBuilder = (*IdentityAccessManagementAPIBuilder)(nil)
var _ builder.APIGroupRouteProvider = (*IdentityAccessManagementAPIBuilder)(nil)
var _ builder.APIGroupValidation = (*IdentityAccessManagementAPIBuilder)(nil)
var _ builder.APIGroupMutation = (*IdentityAccessManagementAPIBuilder)(nil)

// RoleStorageBackend uses the resource.StorageBackend interface to provide storage for custom roles.
// Used by wire to identify the storage backend for custom roles.
type RoleStorageBackend interface{ resource.StorageBackend }

// RoleBindingStorageBackend uses the resource.StorageBackend interface to provide storage for role bindings.
// Used by wire to identify the storage backend for role bindings.
type RoleBindingStorageBackend interface{ resource.StorageBackend }

// ExternalGroupMappingStorageBackend uses the resource.StorageBackend interface to provide storage for external group mappings.
// Used by wire to identify the storage backend for external group mappings.
type ExternalGroupMappingStorageBackend interface{ resource.StorageBackend }

// This is used just so wire has something unique to return
type IdentityAccessManagementAPIBuilder struct {
	// Stores
	store legacy.LegacyIdentityStore

	userLegacyStore                  *user.LegacyStore
	saLegacyStore                    *serviceaccount.LegacyStore
	legacyTeamStore                  *team.LegacyStore
	teamBindingLegacyStore           *teambinding.LegacyBindingStore
	ssoLegacyStore                   *sso.LegacyStore
	roleApiInstaller                 RoleApiInstaller
	globalRoleApiInstaller           GlobalRoleApiInstaller
	teamLBACApiInstaller             TeamLBACApiInstaller
	externalGroupMappingApiInstaller ExternalGroupMappingApiInstaller
	resourcePermissionsStorage       resource.StorageBackend
	mappers                          *resourcepermission.MappersRegistry
	roleBindingsStorage              RoleBindingStorageBackend

	// Required for resource permissions authorization
	// fetches resources parent folders
	resourceParentProvider iamauthorizer.ParentProvider

	// Access Control
	authorizer authorizer.Authorizer
	// legacyAccessClient is used for the identity apis, we need to migrate to the access client
	legacyAccessClient types.AccessClient
	// accessClient is used for the core role apis
	accessClient types.AccessClient
	// zClient is used to populate Zanzana with:
	// - roles
	// - permissions
	// - assignments
	zClient zanzana.Client
	// Buffered channel to limit the amount of concurrent writes to Zanzana
	zTickets chan bool

	reg    prometheus.Registerer
	logger log.Logger

	dual                              dualwrite.Service
	unified                           resource.ResourceClient
	userSearchClient                  resourcepb.ResourceIndexClient
	userSearchHandler                 *user.SearchHandler
	teamSearch                        *TeamSearchHandler
	resourcePermissionsSearchHandler  *resourcepermission.ResourcePermissionsSearchHandler
	externalGroupMappingSearchHandler externalgroupmapping.SearchHandler

	teamGroupsHandler externalgroupmapping.TeamGroupsHandler

	// non-k8s api route
	display *user.LegacyDisplayREST

	// ac is used for legacy permission checks in role bindings.
	// nil where only k8s-mapped permissions are supported.
	ac accesscontrol.AccessControl

	// roleConfigProvider provides the REST config for a dynamic client that fetches
	// roles referenced by role bindings
	roleConfigProvider iamauthorizer.ConfigProvider

	// Not set for multi-tenant deployment for now
	sso ssosettings.Service

	// Toggle for enabling authz management apis
	features featuremgmt.FeatureToggles

	tracing tracing.Tracer

	cfgProvider    configprovider.ConfigProvider
	settingService settingsvc.Service

	apiConfig Config
}

// Config holds IAM-specific configuration
type Config struct {
	SingleOrganization bool
}
