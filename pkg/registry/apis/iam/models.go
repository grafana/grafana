package iam

import (
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/user"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

var _ builder.APIGroupBuilder = (*IdentityAccessManagementAPIBuilder)(nil)
var _ builder.APIGroupRouteProvider = (*IdentityAccessManagementAPIBuilder)(nil)

// CoreRoleStorageBackend uses the resource.StorageBackend interface to provide storage for core roles.
// Used wire to identify the storage backend for core roles.
type CoreRoleStorageBackend interface{ resource.StorageBackend }

// This is used just so wire has something unique to return
type IdentityAccessManagementAPIBuilder struct {
	// Stores
	store            legacy.LegacyIdentityStore
	coreRolesStorage CoreRoleStorageBackend

	// Access Control
	authorizer authorizer.Authorizer
	// legacyAccessClient is used for the identity apis, we need to migrate to the access client
	legacyAccessClient types.AccessClient
	// accessClient is used for the core role apis
	accessClient types.AccessClient

	reg prometheus.Registerer

	// non-k8s api route
	display *user.LegacyDisplayREST

	// Not set for multi-tenant deployment for now
	sso ssosettings.Service

	// Toggle for enabling authz management apis
	enableAuthZApis bool
}
