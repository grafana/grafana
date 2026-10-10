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
