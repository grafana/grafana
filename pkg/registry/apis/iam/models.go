package iam

import (
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/user"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ builder.APIGroupBuilder = (*IdentityAccessManagementAPIBuilder)(nil)
var _ builder.APIGroupRouteProvider = (*IdentityAccessManagementAPIBuilder)(nil)
var _ builder.APIGroupValidation = (*IdentityAccessManagementAPIBuilder)(nil)
var _ builder.APIGroupMutation = (*IdentityAccessManagementAPIBuilder)(nil)

// CoreRoleStorageBackend uses the resource.StorageBackend interface to provide storage for core roles.
// Used by wire to identify the storage backend for core roles.
type CoreRoleStorageBackend interface{ resource.StorageBackend }

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
	store                       legacy.LegacyIdentityStore
	coreRolesStorage            CoreRoleStorageBackend
	rolesStorage                RoleStorageBackend
	resourcePermissionsStorage  resource.StorageBackend
	roleBindingsStorage         RoleBindingStorageBackend
	externalGroupMappingStorage ExternalGroupMappingStorageBackend

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

	dual             dualwrite.Service
	unified          resource.ResourceClient
	userSearchClient resourcepb.ResourceIndexClient

	// non-k8s api route
	display *user.LegacyDisplayREST

	// Not set for multi-tenant deployment for now
	sso ssosettings.Service

	// Toggle for enabling authz management apis
	features featuremgmt.FeatureToggles

	// Toggle for enabling dual writer
	enableDualWriter bool
}
