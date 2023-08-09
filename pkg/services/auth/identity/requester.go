package identity

import "github.com/grafana/grafana/pkg/models/roletype"

const (
	NamespaceUser           = "user"
	NamespaceAPIKey         = "api-key"
	NamespaceServiceAccount = "service-account"
	NamespaceAnonymous      = "anonymous"
	NamespaceRenderService  = "render"
)

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
	GetNamespacedID() (string, string)
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

	// GetCacheKey returns a unique key for the entity.
	// Add an extra prefix to avoid collisions with other caches
	GetCacheKey() (string, error)
	// HasUniqueId returns true if the entity has a unique id
	HasUniqueId() bool
}
