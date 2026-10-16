package legacypermissions

import (
	"slices"
	"sync"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// RoleCatalog holds the current built-in and plugin grants for each basic role.
// Registration publishes complete snapshots; enumeration never calls the service
// that registered them. Readers and writers cannot mutate each other's slices.
type RoleCatalog struct {
	mu    sync.RWMutex
	roles map[string][]ac.Permission
}

func NewRoleCatalog() *RoleCatalog { return &RoleCatalog{} }

func (c *RoleCatalog) Replace(roles map[string][]ac.Permission) {
	next := make(map[string][]ac.Permission, len(roles))
	for role, permissions := range roles {
		next[role] = slices.Clone(permissions)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.roles = next
}

func (c *RoleCatalog) Permissions(roles ...string) []ac.Permission {
	c.mu.RLock()
	defer c.mu.RUnlock()
	var permissions []ac.Permission
	for _, role := range roles {
		permissions = append(permissions, c.roles[role]...)
	}
	return permissions
}
