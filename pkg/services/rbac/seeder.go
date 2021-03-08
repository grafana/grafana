package rbac

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
)

type seeder struct {
	Service *RBACService
	log     log.Logger
}

var builtInPolicies = []PolicyDTO{
	{
		Name:    "grafana:builtin:users:read:self",
		Version: 1,
		Permissions: []Permission{
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
var builtInPolicyGrants = map[string][]string{
	"grafana:builtin:users:read:self": {
		"Viewer",
	},
}

func (s *seeder) Seed(ctx context.Context, orgID int64) error {
	err := s.seed(ctx, orgID, builtInPolicies, builtInPolicyGrants)
	return err
}

func (s *seeder) seed(ctx context.Context, orgID int64, policies []PolicyDTO, policyGrants map[string][]string) error {
	// FIXME: As this will run on startup, we want to optimize running this
	existingPolicies, err := s.Service.GetPolicies(ctx, orgID)
	if err != nil {
		return err
	}
	policySet := map[string]*Policy{}
	for _, policy := range existingPolicies {
		if policy == nil {
			continue
		}
		policySet[policy.Name] = policy
	}

	for _, policy := range policies {
		policy.OrgId = orgID

		current, exists := policySet[policy.Name]
		if exists {
			if policy.Version <= current.Version {
				continue
			}
		}

		policyID, err := s.createOrUpdatePolicy(ctx, policy, current)
		if err != nil {
			s.log.Error("failed to create/update policy", "name", policy.Name, "err", err)
			continue
		}

		if roles, exists := policyGrants[policy.Name]; exists {
			for _, role := range roles {
				err := s.Service.AddBuiltinRolePolicy(ctx, orgID, policyID, role)
				if err != nil && !errors.Is(err, ErrUserPolicyAlreadyAdded) {
					s.log.Error("failed to assign policy to role",
						"name", policy.Name,
						"role", role,
						"err", err,
					)
					return err
				}
			}
		}
	}

	return nil
}

func (s *seeder) createOrUpdatePolicy(ctx context.Context, policy PolicyDTO, old *Policy) (int64, error) {
	if policy.Version == 0 {
		return 0, fmt.Errorf("error when seeding '%s': all seeder policies must have a version", policy.Name)
	}

	if old == nil {
		p, err := s.Service.CreatePolicyWithPermissions(ctx, CreatePolicyWithPermissionsCommand{
			OrgId:       policy.OrgId,
			Version:     policy.Version,
			Name:        policy.Name,
			Description: policy.Description,
			Permissions: policy.Permissions,
		})
		if err != nil {
			return 0, err
		}
		return p.Id, nil
	}

	_, err := s.Service.UpdatePolicy(ctx, UpdatePolicyCommand{
		UID:         old.UID,
		Name:        policy.Name,
		Description: policy.Description,
		Version:     policy.Version,
	})
	if err != nil {
		if errors.Is(err, errVersionLE) {
			return old.Id, nil
		}
		return 0, err
	}

	existingPermissions, err := s.Service.GetPolicyPermissions(ctx, old.Id)
	if err != nil {
		s.log.Info("failed to get current permissions for policy", "name", policy.Name, "err", err)
	}

	err = s.idempotentUpdatePermissions(ctx, old.Id, policy.Permissions, existingPermissions)
	if err != nil {
		s.log.Error("failed to update policy permissions", "name", policy.Name, "err", err)
	}
	return old.Id, nil
}

func (s *seeder) idempotentUpdatePermissions(ctx context.Context, policyID int64, new []Permission, old []Permission) error {
	if policyID == 0 {
		return fmt.Errorf("refusing to add permissions to policy with ID 0 (it should not exist)")
	}

	added, removed := diffPermissionList(new, old)

	for _, p := range added {
		_, err := s.Service.CreatePermission(ctx, CreatePermissionCommand{
			PolicyId:   policyID,
			Permission: p.Permission,
			Scope:      p.Scope,
		})
		if err != nil {
			return fmt.Errorf("could not create permission %s (%s): %w", p.Permission, p.Scope, err)
		}
	}

	for _, p := range removed {
		err := s.Service.DeletePermission(ctx, &DeletePermissionCommand{
			Id: p.Id,
		})
		if err != nil {
			return fmt.Errorf("could not delete permission %s (%s): %w", p.Permission, p.Scope, err)
		}
	}

	return nil
}

func diffPermissionList(new, old []Permission) (added, removed []Permission) {
	newMap, oldMap := permissionMap(new), permissionMap(old)

	added = []Permission{}
	removed = []Permission{}

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

func permissionMap(l []Permission) map[permissionTuple]Permission {
	m := make(map[permissionTuple]Permission, len(l))
	for _, p := range l {
		m[permissionTuple{
			Permission: p.Permission,
			Scope:      p.Scope,
		}] = p
	}
	return m
}
