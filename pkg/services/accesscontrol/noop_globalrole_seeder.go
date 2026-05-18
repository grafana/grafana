package accesscontrol

import (
	"context"

	"github.com/grafana/dskit/services"
)

// GlobalRoleSeederServiceName is the service name used by both the noop and the
// real (enterprise) GlobalRole seeder so the module dependency graph can
// reference it by a stable key.
const GlobalRoleSeederServiceName = "accesscontrol.globalroleseeder"

// NoopGlobalRoleSeeder is a no-op implementation of the GlobalRole seeder for
// OSS builds. It is always disabled so the module manager registers an empty
// module that resolves immediately. Enterprise provides the real
// implementation via Wire, which overwrites this module in the dskit module
// manager.
type NoopGlobalRoleSeeder struct {
	services.NamedService
}

func ProvideNoopGlobalRoleSeeder() *NoopGlobalRoleSeeder {
	s := &NoopGlobalRoleSeeder{}
	s.NamedService = services.NewIdleService(nil, nil).
		WithName(GlobalRoleSeederServiceName)
	return s
}

// IsDisabled always returns true — OSS does not seed code-defined roles into
// the GlobalRole resource (Enterprise-only RBAC concept).
func (s *NoopGlobalRoleSeeder) IsDisabled() bool { return true }

// Run satisfies the registry.BackgroundService interface.
func (s *NoopGlobalRoleSeeder) Run(_ context.Context) error {
	return nil
}
