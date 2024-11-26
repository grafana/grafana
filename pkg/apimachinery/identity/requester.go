package identity

import (
	"fmt"
	"strconv"

	"github.com/grafana/authlib/claims"
	"k8s.io/apiserver/pkg/authentication/user"
)

type Requester interface {
	user.Info
	claims.AuthInfo

	// GetIdentityType returns the type for the requester
	GetIdentityType() claims.IdentityType
	// IsIdentityType returns true if identity type for requester matches any expected identity type
	IsIdentityType(expected ...claims.IdentityType) bool
	// GetRawIdentifier returns only the identifier part of the UID, excluding the type
	GetRawIdentifier() string
	// GetInternalID returns only the identifier part of the ID, excluding the type
	GetInternalID() (int64, error)
	// GetID returns namespaced internalID for the entity
	// Deprecated: use GetUID instead
	GetID() string
	// GetEmail returns the email of the active entity.
	// Can be empty.
	GetEmail() string
	// IsEmailVerified returns if email is verified for entity.
	IsEmailVerified() bool
	// GetIsGrafanaAdmin returns true if the user is a server admin
	GetIsGrafanaAdmin() bool
	// GetLogin returns the login of the active entity
	// Can be empty.
	GetLogin() string
	// GetOrgID returns the ID of the active organization
	GetOrgID() int64
	// GetOrgRole returns the role of the active entity in the active organization.
	GetOrgRole() RoleType
	// GetPermissions returns the permissions of the active entity.
	GetPermissions() map[string][]string
	// GetGlobalPermissions returns the permissions of the active entity that are available across all organizations.
	GetGlobalPermissions() map[string][]string
	// DEPRECATED: GetTeams returns the teams the entity is a member of.
	// Retrieve the teams from the team service instead of using this method.
	GetTeams() []int64
	// DEPRECATED: GetOrgName returns the name of the active organization.
	// Retrieve the organization name from the organization service instead of using this method.
	GetOrgName() string
	// GetAuthID returns external id for entity.
	GetAuthID() string
	// GetNamespace returns either "*" or the single namespace this requester has access to
	// An empty value means the implementation has not specified a kubernetes namespace.
	GetNamespace() string
	// GetAuthenticatedBy returns the authentication method used to authenticate the entity.
	GetAuthenticatedBy() string
	// IsAuthenticatedBy returns true if entity was authenticated by any of supplied providers.
	IsAuthenticatedBy(providers ...string) bool
	// IsNil returns true if the identity is nil
	// FIXME: remove this method once all services are using an interface
	IsNil() bool
	// GetIDToken returns a signed token representing the identity that can be forwarded to plugins and external services.
	GetIDToken() string

	// Legacy

	// HasRole returns true if the active entity has the given role in the active organization.
	HasRole(role RoleType) bool
	// GetCacheKey returns a unique key for the entity.
	// Add an extra prefix to avoid collisions with other caches
	GetCacheKey() string
	// HasUniqueId returns true if the entity has a unique id
	HasUniqueId() bool
}

// IntIdentifier converts a typeID to an int64.
// Applicable for users, service accounts, api keys and renderer service.
// Errors if the identifier is not initialized or if type is not recognized.
func IntIdentifier(typedID string) (int64, error) {
	typ, id, err := claims.ParseTypeID(typedID)
	if err != nil {
		return 0, err
	}

	return intIdentifier(typ, id, claims.TypeUser, claims.TypeAPIKey, claims.TypeServiceAccount, claims.TypeRenderService)
}

// UserIdentifier converts a typeID to an int64.
// Errors if the identifier is not initialized or if namespace is not recognized.
// Returns 0 if the type is not user or service account
func UserIdentifier(typedID string) (int64, error) {
	typ, id, err := claims.ParseTypeID(typedID)
	if err != nil {
		return 0, err
	}

	return intIdentifier(typ, id, claims.TypeUser, claims.TypeServiceAccount)
}

func intIdentifier(typ claims.IdentityType, id string, expected ...claims.IdentityType) (int64, error) {
	if claims.IsIdentityType(typ, expected...) {
		id, err := strconv.ParseInt(id, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("unrecognized format for valid type %s: %w", typ, err)
		}

		if id < 1 {
			return 0, ErrIdentifierNotInitialized
		}

		return id, nil
	}

	return 0, ErrNotIntIdentifier
}
