package seeder

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type seeder struct {
	Store accesscontrol.Store
	log   log.Logger
}

var builtInRoles = []accesscontrol.RoleDTO{
	{
		Name:    "grafana:builtin:users:read:self",
		Version: 1,
		Permissions: []accesscontrol.Permission{
			{
				Permission: "users:read",
				Scope:      "users:self",
			},
			{
				Permission: "users.tokens:list",
				Scope:      "users:self",
			},
			{
				Permission: "users.teams:read",
				Scope:      "users:self",
			},
		},
	},
}

// FIXME: Make sure builtin grants can be removed without being recreated
var builtInRoleGrants = map[string][]string{
	"grafana:builtin:users:read:self": {
		"Viewer",
	},
}

func NewSeeder(s accesscontrol.AccessControl, log log.Logger) *seeder {
	return &seeder{Store: s, log: log}
}

func (s *seeder) Seed(ctx context.Context, orgID int64) error {
	err := s.seed(ctx, orgID, builtInRoles, builtInRoleGrants)
	return err
}

func (s *seeder) seed(ctx context.Context, orgID int64, roles []accesscontrol.RoleDTO, roleGrants map[string][]string) error {
	// FIXME: As this will run on startup, we want to optimize running this
	existingRoles, err := s.Store.GetRoles(ctx, orgID)
	if err != nil {
		return err
	}
	roleSet := map[string]*accesscontrol.Role{}
	for _, role := range existingRoles {
		if role == nil {
			continue
		}
		roleSet[role.Name] = role
	}

	for _, role := range roles {
		role.OrgID = orgID

		current, exists := roleSet[role.Name]
		if exists {
			if role.Version <= current.Version {
				continue
			}
		}

		roleID, err := s.createOrUpdateRole(ctx, role, current)
		if err != nil {
			s.log.Error("failed to create/update role", "name", role.Name, "err", err)
			continue
		}

		if builtinRoles, exists := roleGrants[role.Name]; exists {
			for _, builtinRole := range builtinRoles {
				err := s.Store.AddBuiltinRole(ctx, orgID, roleID, builtinRole)
				if err != nil && !errors.Is(err, accesscontrol.ErrUserRoleAlreadyAdded) {
					s.log.Error("failed to assign role to role",
						"name", role.Name,
						"role", builtinRole,
						"err", err,
					)
					return err
				}
			}
		}
	}

	return nil
}

func (s *seeder) createOrUpdateRole(ctx context.Context, role accesscontrol.RoleDTO, old *accesscontrol.Role) (int64, error) {
	if role.Version == 0 {
		return 0, fmt.Errorf("error when seeding '%s': all seeder roles must have a version", role.Name)
	}

	if old == nil {
		p, err := s.Store.CreateRoleWithPermissions(ctx, accesscontrol.CreateRoleWithPermissionsCommand{
			OrgID:       role.OrgID,
			Version:     role.Version,
			Name:        role.Name,
			Description: role.Description,
			Permissions: role.Permissions,
		})
		if err != nil {
			return 0, err
		}
		return p.ID, nil
	}

	_, err := s.Store.UpdateRole(ctx, accesscontrol.UpdateRoleCommand{
		UID:         old.UID,
		Name:        role.Name,
		Description: role.Description,
		Version:     role.Version,
	})
	if err != nil {
		if errors.Is(err, accesscontrol.ErrVersionLE) {
			return old.ID, nil
		}
		return 0, err
	}

	existingPermissions, err := s.Store.GetRolePermissions(ctx, old.ID)
	if err != nil {
		return 0, fmt.Errorf("failed to get current permissions for role '%s': %w", role.Name, err)
	}

	err = s.idempotentUpdatePermissions(ctx, old.ID, role.Permissions, existingPermissions)
	if err != nil {
		return 0, fmt.Errorf("failed to update role permissions for role '%s': %w", role.Name, err)
	}
	return old.ID, nil
}

func (s *seeder) idempotentUpdatePermissions(ctx context.Context, roleID int64, new []accesscontrol.Permission, old []accesscontrol.Permission) error {
	if roleID == 0 {
		return fmt.Errorf("refusing to add permissions to role with ID 0 (it should not exist)")
	}

	added, removed := diffPermissionList(new, old)

	for _, p := range added {
		_, err := s.Store.CreatePermission(ctx, accesscontrol.CreatePermissionCommand{
			RoleID:     roleID,
			Permission: p.Permission,
			Scope:      p.Scope,
		})
		if err != nil {
			return fmt.Errorf("could not create permission %s (%s): %w", p.Permission, p.Scope, err)
		}
	}

	for _, p := range removed {
		err := s.Store.DeletePermission(ctx, &accesscontrol.DeletePermissionCommand{
			ID: p.ID,
		})
		if err != nil {
			return fmt.Errorf("could not delete permission %s (%s): %w", p.Permission, p.Scope, err)
		}
	}

	return nil
}

func diffPermissionList(new, old []accesscontrol.Permission) (added, removed []accesscontrol.Permission) {
	newMap, oldMap := permissionMap(new), permissionMap(old)

	added = []accesscontrol.Permission{}
	removed = []accesscontrol.Permission{}

	for _, p := range newMap {
		if _, exists := oldMap[permissionTuple{
			Permission: p.Permission,
			Scope:      p.Scope,
		}]; exists {
			continue
		}
		added = append(added, p)
	}

	for _, p := range oldMap {
		if _, exists := newMap[permissionTuple{
			Permission: p.Permission,
			Scope:      p.Scope,
		}]; exists {
			continue
		}
		removed = append(removed, p)
	}

	return added, removed
}

type permissionTuple struct {
	Permission string
	Scope      string
}

func permissionMap(l []accesscontrol.Permission) map[permissionTuple]accesscontrol.Permission {
	m := make(map[permissionTuple]accesscontrol.Permission, len(l))
	for _, p := range l {
		m[permissionTuple{
			Permission: p.Permission,
			Scope:      p.Scope,
		}] = p
	}
	return m
}
