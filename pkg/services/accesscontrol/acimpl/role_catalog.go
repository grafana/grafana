package acimpl

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
)

// RoleCatalog exposes the shared registration data, not a permission evaluator.
// It is acquired during construction; enumeration reads the catalog directly.
func (s *Service) RoleCatalog() *legacypermissions.RoleCatalog {
	s.rolesMu.Lock()
	defer s.rolesMu.Unlock()
	if s.roleCatalog == nil {
		s.roleCatalog = legacypermissions.NewRoleCatalog()
		s.publishRoleCatalogLocked()
	}
	return s.roleCatalog
}

// updateRoles publishes and invalidates once per complete registration batch.
// Take the catalog registration lock before rolesMu: a loader can be waiting on
// a shared cache fill whose legacy reader still needs rolesMu.
func (s *Service) updateRoles(update func()) {
	register := func() {
		s.rolesMu.Lock()
		defer s.rolesMu.Unlock()
		update()
		s.publishRoleCatalogLocked()
		if s.cache != nil {
			s.cache.Flush()
		}
	}
	if s.roleCatalog == nil {
		register()
		return
	}
	s.roleCatalog.WithRegistration(register)
}

func (s *Service) publishRoleCatalogLocked() {
	if s.roleCatalog == nil {
		return
	}
	roles := make(map[string][]accesscontrol.Permission, len(s.roles))
	for name, role := range s.roles {
		roles[name] = role.Permissions
	}
	s.roleCatalog.Replace(roles)
}
