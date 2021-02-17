package rbac

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
)

type seeder struct {
	Service *RBACService
	log     log.Logger
}

var builtInPolicies = []PolicyDTO{
	{
		Name:        "grafana:builtin:users:read:self",
		Description: "v1",
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

func (s *seeder) Seed(ctx context.Context, orgID int64) error {
	_, err := s.seed(ctx, orgID, builtInPolicies)
	return err
}

func (s *seeder) seed(ctx context.Context, orgID int64, policies []PolicyDTO) (bool, error) {
	// FIXME: As this will run on startup, we want to optimize running this
	existingPolicies, err := s.Service.GetPolicies(ctx, orgID)
	if err != nil {
		return false, err
	}
	policySet := map[string]*Policy{}
	for _, policy := range existingPolicies {
		if policy == nil {
			continue
		}
		policySet[policy.Name] = policy
	}

	var ran bool

	for _, policy := range policies {
		policy.OrgId = orgID

		current, exists := policySet[policy.Name]
		if exists {
			if policy.Description == current.Description {
				continue
			}
		}

		p, err := s.createOrUpdatePolicy(ctx, policy, current)
		if err != nil {
			s.log.Error("failed to create/update policy", "name", policy.Name, "err", err)
			continue
		}
		if p == 0 {
			// remote version was equal or newer than current version
			continue
		}

		existingPermissions, err := s.Service.GetPolicyPermissions(ctx, p)
		if err != nil {
			s.log.Info("failed to get current permissions for policy", "name", policy.Name, "err", err)
		}

		err = s.idempotentUpdatePermissions(ctx, p, policy.Permissions, existingPermissions)
		if err != nil {
			s.log.Error("failed to update policy permissions", "name", policy.Name, "err", err)
		}
		ran = true
	}

	return ran, nil
}

func (s *seeder) createOrUpdatePolicy(ctx context.Context, policy PolicyDTO, old *Policy) (int64, error) {
	if old == nil {
		p, err := s.Service.CreatePolicy(ctx, CreatePolicyCommand{
			OrgId:       policy.OrgId,
			Name:        policy.Name,
			Description: policy.Description,
		})
		if err != nil {
			return 0, err
		}
		return p.Id, nil
	}

	// FIXME: We probably want to be able to have a description as well
	currentVersion, err := strconv.Atoi(policy.Description[1:])
	if err != nil {
		return 0, fmt.Errorf(
			"failed to read version for policy %s (\"%s\"): %w",
			policy.Name,
			policy.Description,
			err,
		)
	}

	var oldVersion int
	if strings.HasPrefix(old.Description, "v") {
		oldVersion, err = strconv.Atoi(old.Description[1:])
		if err != nil {
			return 0, fmt.Errorf(
				"failed to read previous version for policy %s (\"%s\"): %w",
				policy.Name,
				old.Description,
				err,
			)
		}
	}

	if oldVersion >= currentVersion {
		return 0, nil
	}

	_, err = s.Service.UpdatePolicy(ctx, UpdatePolicyCommand{
		UID:         old.UID,
		Name:        policy.Name,
		Description: policy.Description,
	})
	if err != nil {
		return 0, err
	}
	return old.Id, nil
}

func (s *seeder) idempotentUpdatePermissions(ctx context.Context, policyID int64, new []Permission, old []Permission) error {
	if policyID == 0 {
		return fmt.Errorf("refusing to add permissions to policy with ID 0 (it should not exist)")
	}

	added, removed := diffPermissionList(new, old)

	for _, p := range added {
		_, err := s.Service.CreatePermission(ctx, &CreatePermissionCommand{
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
