package identity

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/models/roletype"
)

const (
	NamespaceUser           = "user"
	NamespaceAPIKey         = "api-key"
	NamespaceServiceAccount = "service-account"
	NamespaceAnonymous      = "anonymous"
	NamespaceRenderService  = "render"
)

var ErrNotIntIdentifier = errors.New("identifier is not an int64")
var ErrIdentifierNotInitialized = errors.New("identifier is not initialized")

type Requester interface {
	// GetDisplayName returns the display name of the active entity.
	// The display name is the name if it is set, otherwise the login or email.
	GetDisplayName() string
	// GetEmail returns the email of the active entity.
	// Can be empty.
	GetEmail() string
	// GetIsGrafanaAdmin returns true if the user is a server admin
	GetIsGrafanaAdmin() bool
	// GetLogin returns the login of the active entity
	// Can be empty.
	GetLogin() string
	// GetNamespacedID returns the namespace and ID of the active entity.
	// The namespace is one of the constants defined in pkg/services/auth/identity.
	GetNamespacedID() (namespace string, identifier string)
	// GetOrgID returns the ID of the active organization
	GetOrgID() int64
	// GetOrgRole returns the role of the active entity in the active organization.
	GetOrgRole() roletype.RoleType
	// GetPermissions returns the permissions of the active entity.
	GetPermissions() map[string][]string
	// DEPRECATED: GetTeams returns the teams the entity is a member of.
	// Retrieve the teams from the team service instead of using this method.
	GetTeams() []int64
	// DEPRECATED: GetOrgName returns the name of the active organization.
	// Retrieve the organization name from the organization service instead of using this method.
	GetOrgName() string

	// IsNil returns true if the identity is nil
	// FIXME: remove this method once all services are using an interface
	IsNil() bool

	// Legacy

	// HasRole returns true if the active entity has the given role in the active organization.
	HasRole(role roletype.RoleType) bool
	// GetCacheKey returns a unique key for the entity.
	// Add an extra prefix to avoid collisions with other caches
	GetCacheKey() (string, error)
	// HasUniqueId returns true if the entity has a unique id
	HasUniqueId() bool
	// AuthenticatedBy returns the authentication method used to authenticate the entity.
	GetAuthenticatedBy() string
}

// IntIdentifier converts a string identifier to an int64.
// Applicable for users, service accounts, api keys and renderer service.
// Errors if the identifier is not initialized or if namespace is not recognized.
func IntIdentifier(namespace, identifier string) (int64, error) {
	switch namespace {
	case NamespaceUser, NamespaceAPIKey, NamespaceServiceAccount, NamespaceRenderService:
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
