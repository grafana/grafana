package registry

import (
	"context"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type FixedRoleRegistry interface {
	// RegisterFixedRole saves a fixed role and assigns it to built-in roles
	RegisterFixedRole(ctx context.Context, role accesscontrol.RoleDTO, builtInRoles []string) error
}

// RegisterRegistrantsRoles browses the registry for RoleRegistrant services
// then save and assigns the fixed roles they declared
func RegisterRegistrantsRoles(ctx context.Context, reg FixedRoleRegistry) error {
	services := registry.GetServices()
	for _, svc := range services {
		registrant, ok := svc.Instance.(registry.RoleRegistrant)
		if !ok {
			continue
		}

		registrations := registrant.GetFixedRoleRegistrations()
		for _, r := range registrations {
			err := reg.RegisterFixedRole(ctx, r.Role, r.Grants)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
