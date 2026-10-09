package legacyclient

import (
	"context"

	"github.com/grafana/authlib/types"
)

// Service enumerates permissions for trusted legacy Grafana callers.
// Implementations must return a complete snapshot or an error, never a partial
// snapshot. Duplicate action/scope pairs are significant and must be preserved.
//
// This is Grafana's legacy compatibility seam, not a general authorization
// interface. New consumers should check access instead of enumerating it.
type Service interface {
	// caller is the authenticated service identity, distinct from req.Identity.
	LegacyGetUserPermissions(ctx context.Context, caller types.AuthInfo, req LegacyGetUserPermissionsRequest) (LegacyGetUserPermissionsResponse, error)
}

// LegacyPermissionIdentity contains assertions from trusted Grafana
// authentication code, not user-supplied identity overrides. The embedded server
// must validate the caller, instance namespace and scope before using them.
// Standalone servers must not accept these assertions merely because the caller
// has a permission-enumeration grant.
type LegacyPermissionIdentity struct {
	Type types.IdentityType
	// UID is the identifier without a type prefix; Type supplies its type.
	// Numeric-looking UIDs must never be interpreted as internal IDs.
	UID string
	// InternalID distinguishes an absent legacy ID from a supplied zero ID.
	InternalID *int64
	// HasUniqueID preserves legacy cacheability, including synthetic identities.
	HasUniqueID    bool
	OrgRole        string
	IsGrafanaAdmin bool
	// TeamIDs are legacy numeric RBAC memberships, not contextual groups.
	TeamIDs []int64
	// Groups are the target's selected contextual groups for Zanzana. They must
	// not be substituted with the authenticated service caller's groups.
	Groups []string
	// CacheKey preserves the requester's existing shared-cache identity. An
	// explicit empty value differs from absence (derive a conventional key).
	CacheKey *string
	// RequesterNamespace preserves the original namespace used by legacy
	// Zanzana resolution, including an explicit empty value. It does not select
	// tenant scope; a nonempty value must match the request Namespace, except
	// org--1 for self-managed NoOrgMembership evaluation.
	RequesterNamespace *string
}

type LegacyGetUserPermissionsRequest struct {
	Identity LegacyPermissionIdentity
	// Namespace is a concrete transport scope, independent of the evaluation
	// org sentinel. Self-managed global/no-membership calls with no concrete
	// namespace use default as an instance-local anchor, never for evaluation.
	Namespace string
	// GlobalOrg selects instance-global legacy grants (org zero).
	// It never authorizes cross-tenant access.
	GlobalOrg bool
	// NoOrgMembership preserves the authenticated legacy OrgID=-1 state.
	// It is mutually exclusive with GlobalOrg. When neither flag is set,
	// evaluation uses the namespace's organization.
	NoOrgMembership bool
	ReloadCache     bool
	// SkipZanzanaCache bypasses reading and writing the Zanzana cache only.
	// It does not imply ReloadCache.
	SkipZanzanaCache bool
}

type LegacyGetUserPermissionsResponse struct {
	Permissions []types.Permission
}
