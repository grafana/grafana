package acimpl

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// FixedRoleReplacer is implemented by a service that can replace, at runtime,
// the fixed roles a caller declared. Callers type-assert an
// accesscontrol.Service to it.
type FixedRoleReplacer interface {
	ReplaceFixedRoles(ctx context.Context, owner string, registrations ...accesscontrol.RoleRegistration) error
}

var _ FixedRoleReplacer = (*Service)(nil)

// ReplaceFixedRoles makes registrations the whole set of fixed roles owner
// declares: roles it declared before and leaves out are removed, changed ones
// are updated and new ones added. The registrations are validated as
// DeclareFixedRoles validates them, and may not name a role declared by anyone
// else. Each call replaces the last, so repeating one changes nothing.
//
// Before RegisterFixedRoles, the set is only recorded, and RegisterFixedRoles
// applies it. After, the basic roles are rebuilt from every registration, the
// permission cache is flushed, and the roles and the basic roles' permissions
// are written to the database, as RegisterFixedRoles writes them.
func (s *Service) ReplaceFixedRoles(ctx context.Context, owner string, registrations ...accesscontrol.RoleRegistration) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.ReplaceFixedRoles")
	defer span.End()

	names := make(map[string]bool, len(registrations))
	for _, r := range registrations {
		if err := accesscontrol.ValidateFixedRole(r.Role); err != nil {
			return err
		}
		if err := accesscontrol.ValidateBuiltInRoles(r.Grants); err != nil {
			return err
		}
		if names[r.Role.Name] {
			return fmt.Errorf("role %q is declared more than once", r.Role.Name)
		}
		names[r.Role.Name] = true
	}

	s.seedMu.Lock()
	defer s.seedMu.Unlock()

	s.rolesMu.Lock()
	previous := s.ownedRoles[owner]
	var conflict error
	s.registrations.Range(func(r accesscontrol.RoleRegistration) bool {
		if names[r.Role.Name] && !previous[r.Role.Name] {
			conflict = fmt.Errorf("role %q is already declared", r.Role.Name)
			return false
		}
		return true
	})
	if conflict != nil {
		s.rolesMu.Unlock()
		return conflict
	}
	for _, r := range registrations {
		for _, p := range r.Role.Permissions {
			if err := s.permRegistry.RegisterPermission(p.Action, p.Scope); err != nil {
				s.rolesMu.Unlock()
				return err
			}
		}
	}

	s.registrations.Replace(func(r accesscontrol.RoleRegistration) bool { return previous[r.Role.Name] }, registrations...)
	if s.ownedRoles == nil {
		s.ownedRoles = map[string]map[string]bool{}
	}
	if len(names) == 0 {
		delete(s.ownedRoles, owner)
	} else {
		s.ownedRoles[owner] = names
	}

	if !s.isInitialized {
		s.rolesMu.Unlock()
		return nil
	}
	// The basic roles only ever accumulate permissions, so rebuild them to
	// drop the ones the replaced roles granted.
	s.roles = accesscontrol.BuildBasicRoleDefinitions()
	s.registrations.Range(func(r accesscontrol.RoleRegistration) bool {
		s.registerRolesLocked(r)
		return true
	})
	rolesSnapshot := s.getBasicRolePermissionsLocked()
	s.rolesMu.Unlock()
	s.cache.Flush()

	if s.seeder != nil {
		removed := make([]string, 0, len(previous))
		for name := range previous {
			if !names[name] {
				removed = append(removed, name)
			}
		}
		s.seeder.ForgetFixedRoles(removed...)
		if err := s.seeder.SeedRoles(ctx, registrations); err != nil {
			return err
		}
		if len(removed) > 0 {
			if err := s.seeder.RemoveAbsentRoles(ctx); err != nil {
				return err
			}
		}
	}
	return s.refreshBasicRolePermissionsInDB(ctx, rolesSnapshot)
}
