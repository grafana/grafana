package identity

import (
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/models/roletype"
)

type Requester interface {
	// GetID returns namespaced id for the entity
	GetID() NamespaceID
	// GetNamespacedID returns the namespace and ID of the active entity.
	// The namespace is one of the constants defined in pkg/services/auth/identity.
	// Deprecated: use GetID instead
	GetNamespacedID() (namespace Namespace, identifier string)
	// GetUID returns namespaced uid for the entity
	GetUID() NamespaceID
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
	GetOrgRole() roletype.RoleType
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
	// GetAuthenticatedBy returns the authentication method used to authenticate the entity.
	GetAuthenticatedBy() string
	// IsAuthenticatedBy returns true if entity was authenticated by any of supplied providers.
	IsAuthenticatedBy(providers ...string) bool
	// IsNil returns true if the identity is nil
	// FIXME: remove this method once all services are using an interface
	IsNil() bool

	// Legacy

	// HasRole returns true if the active entity has the given role in the active organization.
	HasRole(role roletype.RoleType) bool
	// GetCacheKey returns a unique key for the entity.
	// Add an extra prefix to avoid collisions with other caches
	GetCacheKey() string
	// HasUniqueId returns true if the entity has a unique id
	HasUniqueId() bool
	// GetIDToken returns a signed token representing the identity that can be forwarded to plugins and external services.
	// Will only be set when featuremgmt.FlagIdForwarding is enabled.
	GetIDToken() string
}

// IsNamespace returns true if namespace matches any expected namespace
func IsNamespace(namespace Namespace, expected ...Namespace) bool {
	for _, e := range expected {
		if namespace == e {
			return true
		}
	}

	return false
}

// IntIdentifier converts a string identifier to an int64.
// Applicable for users, service accounts, api keys and renderer service.
// Errors if the identifier is not initialized or if namespace is not recognized.
func IntIdentifier(namespace Namespace, identifier string) (int64, error) {
	if IsNamespace(namespace, NamespaceUser, NamespaceAPIKey, NamespaceServiceAccount, NamespaceRenderService) {
		id, err := strconv.ParseInt(identifier, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("unrecognized format for valid namespace %s: %w", namespace, err)
		}

		if id < 1 {
			return 0, ErrIdentifierNotInitialized
		}

		return id, nil
	}

	return 0, ErrNotIntIdentifier
}

// UserIdentifier converts a string identifier to an int64.
// Errors if the identifier is not initialized or if namespace is not recognized.
// Returns 0 if the namespace is not user or service account
func UserIdentifier(namespace Namespace, identifier string) (int64, error) {
	userID, err := IntIdentifier(namespace, identifier)
	if err != nil {
		// FIXME: return this error once entity namespaces are handled by stores
		return 0, nil
	}

	if IsNamespace(namespace, NamespaceUser, NamespaceServiceAccount) {
		return userID, nil
	}

	return 0, nil
}
