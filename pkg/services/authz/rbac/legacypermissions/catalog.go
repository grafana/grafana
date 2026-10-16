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
	// Registration excludes complete loader cache fills, not just catalog reads.
	registrationMu sync.RWMutex
	mu             sync.RWMutex
	roles          map[string][]ac.Permission
}

func NewRoleCatalog() *RoleCatalog { return &RoleCatalog{} }

// WithRegistration serializes a registration batch with catalog-backed loads.
// The callback publishes the completed catalog and invalidates shared caches.
// It must acquire any service role lock inside this callback, never before it,
// and must not enumerate permissions from inside the callback.
func (c *RoleCatalog) WithRegistration(register func()) {
	c.registrationMu.Lock()
	defer c.registrationMu.Unlock()
	register()
}

// Replace installs an immutable snapshot. Live registration must wrap this call
// and cache invalidation in WithRegistration.
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
