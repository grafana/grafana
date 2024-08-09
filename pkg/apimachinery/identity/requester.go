package identity

import (
	"fmt"
	"strconv"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/claims"
	"k8s.io/apiserver/pkg/authentication/user"
)

type Requester interface {
	user.Info
	claims.AuthInfo

	// GetIdentityType returns the type for the requester
	GetIdentityType() IdentityType
	// GetRawIdentifier returns only the identifier part of the UID, excluding the type
	GetRawIdentifier() string
	// Deprecated: use GetUID instead
	GetInternalID() (int64, error)
	// GetID returns namespaced internalID for the entity
	// Deprecated: use GetUID instead
	GetID() TypedID
	// GetDisplayName returns the display name of the active entity.
	// The display name is the name if it is set, otherwise the login or email.
	GetDisplayName() string
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
	// GetAllowedKubernetesNamespace returns either "*" or the single namespace this requester has access to
	// An empty value means the implementation has not specified a kubernetes namespace.
	GetAllowedKubernetesNamespace() string
	// GetAuthenticatedBy returns the authentication method used to authenticate the entity.
	GetAuthenticatedBy() string
	// IsAuthenticatedBy returns true if entity was authenticated by any of supplied providers.
	IsAuthenticatedBy(providers ...string) bool
	// IsNil returns true if the identity is nil
	// FIXME: remove this method once all services are using an interface
	IsNil() bool

	// Legacy

	// HasRole returns true if the active entity has the given role in the active organization.
	HasRole(role RoleType) bool
	// GetCacheKey returns a unique key for the entity.
	// Add an extra prefix to avoid collisions with other caches
	GetCacheKey() string
	// HasUniqueId returns true if the entity has a unique id
	HasUniqueId() bool
	// GetIDToken returns a signed token representing the identity that can be forwarded to plugins and external services.
	// Will only be set when featuremgmt.FlagIdForwarding is enabled.
	GetIDToken() string
	// GetIDClaims returns the claims of the ID token.
	GetIDClaims() *authnlib.Claims[authnlib.IDTokenClaims]
}

// IntIdentifier converts a typeID to an int64.
// Applicable for users, service accounts, api keys and renderer service.
// Errors if the identifier is not initialized or if type is not recognized.
func IntIdentifier(typedID TypedID) (int64, error) {
	if IsIdentityType(typedID, TypeUser, TypeAPIKey, TypeServiceAccount, TypeRenderService) {
		id, err := strconv.ParseInt(typedID.ID(), 10, 64)
		if err != nil {
			return 0, fmt.Errorf("unrecognized format for valid type %s: %w", typedID.Type(), err)
		}

		if id < 1 {
			return 0, ErrIdentifierNotInitialized
		}

		return id, nil
	}

	return 0, ErrNotIntIdentifier
}

// UserIdentifier converts a typeID to an int64.
// Errors if the identifier is not initialized or if namespace is not recognized.
// Returns 0 if the type is not user or service account
func UserIdentifier(typedID TypedID) (int64, error) {
	userID, err := IntIdentifier(typedID)
	if err != nil {
		return 0, err
	}

	if IsIdentityType(typedID, TypeUser, TypeServiceAccount) {
		return userID, nil
	}

	return 0, ErrInvalidIDType
}
