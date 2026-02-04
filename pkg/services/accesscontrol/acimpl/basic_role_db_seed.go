package acimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	ossBasicRoleSeedLockName = "oss-ac-basic-role-seeder"
	ossBasicRoleSeedTimeout  = 2 * time.Minute
)

// refreshBasicRolePermissionsInDB ensures basic role permissions are fully derived from in-memory registrations
func (s *Service) refreshBasicRolePermissionsInDB(ctx context.Context, rolesSnapshot map[string][]accesscontrol.Permission) error {
	if s.sql == nil || s.seeder == nil {
		return nil
	}

	run := func(ctx context.Context) error {
		desired := map[accesscontrol.SeedPermission]struct{}{}
		for role, permissions := range rolesSnapshot {
			for _, permission := range permissions {
				desired[accesscontrol.SeedPermission{BuiltInRole: role, Action: permission.Action, Scope: permission.Scope}] = struct{}{}
			}
		}
		s.seeder.SetDesiredPermissions(desired)
		return s.seeder.Seed(ctx)
	}

	if s.serverLock == nil {
		return run(ctx)
	}

	var err error
	errLock := s.serverLock.LockExecuteAndRelease(ctx, ossBasicRoleSeedLockName, ossBasicRoleSeedTimeout, func(ctx context.Context) {
		err = run(ctx)
	})
	if errLock != nil {
		return errLock
	}
	return err
}
