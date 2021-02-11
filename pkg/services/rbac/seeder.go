package rbac

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

type seeder struct {
	Service RBACService
}

var builtInPolicies = []PolicyDTO{
	{
		Name:        "grafana:builtin:users:self",
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

func (s seeder) Seed(ctx context.Context, orgID int64) error {
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

	for _, policy := range builtInPolicies {
		policy.OrgId = orgID

		current, exists := policySet[policy.Name]
		if exists {
			if policy.Description == current.Description {
				continue
			}
		}

		p, err := s.createOrUpdatePolicy(ctx, policy, current)
		if err != nil {
			s.Service.log.Error("failed to create/update policy", "name", policy.Name, "err", err)
			continue
		}
		if p == nil {
			// remote version was equal or newer than current version
			continue
		}

		existingPermissions, err := s.Service.GetPolicyPermissions(ctx, p.Id)
		if err != nil {
			s.Service.log.Info("failed to get current permissions for policy", "name", policy.Name, "err", err)
		}

		err = s.idempotentUpdatePermissions(ctx, p.Id, policy.Permissions, existingPermissions)
		if err != nil {
			s.Service.log.Error("failed to update policy permissions", "name", policy.Name, "err", err)
		}
	}

	return nil
}

func (s seeder) createOrUpdatePolicy(ctx context.Context, policy PolicyDTO, old *Policy) (*Policy, error) {
	if old == nil {
		return s.Service.CreatePolicy(ctx, CreatePolicyCommand{
			OrgId:       policy.OrgId,
			Name:        policy.Name,
			Description: policy.Description,
		})
	}

	// FIXME: We probably want to be able to have a description as well
	currentVersion, err := strconv.Atoi(policy.Description[1:])
	if err != nil {
		return nil, fmt.Errorf(
			"failed to read version for policy %s (\"%s\"): %w",
			policy.Name,
			policy.Description,
			err,
		)
	}

	var oldVersion int
	if strings.HasPrefix(old.Description, "v") {
		oldVersion, err = strconv.Atoi(policy.Description[1:])
		return nil, fmt.Errorf(
			"failed to read previous version for policy %s (\"%s\"): %w",
			policy.Name,
			old.Description,
			err,
		)
	}

	if oldVersion >= currentVersion {
		return nil, nil
	}

	return s.Service.UpdatePolicy(ctx, UpdatePolicyCommand{
		Id:          old.Id,
		Name:        policy.Name,
		Description: policy.Description,
	})
}

func (s seeder) idempotentUpdatePermissions(ctx context.Context, policyID int64, new []Permission, old []Permission) error {
	panic("implement me")
}
