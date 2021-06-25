package registry

import (
	"context"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type FixedRoleRegistry interface {
	RegisterFixedRole(ctx context.Context, role accesscontrol.RoleDTO, builtInRoles []string) error
}

func RegisterRegistrantsRoles(reg FixedRoleRegistry) error {
	services := registry.GetServices()
	for _, svc := range services {
		registrant, ok := svc.Instance.(registry.RoleRegistrant)
		if !ok {
			continue
		}

		registrations := registrant.GetFixedRoleRegistrations()
		for _, r := range registrations {
			err := reg.RegisterFixedRole(context.TODO(), r.Role, r.Grants)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
