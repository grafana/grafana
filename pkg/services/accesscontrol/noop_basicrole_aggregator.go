package accesscontrol

import (
	"context"

	"github.com/grafana/dskit/services"
)

// BasicRoleAggregatorServiceName is the service name used by both the noop
// and the real (enterprise) basic-role aggregator so the module dependency
// graph can reference it by a stable key.
const BasicRoleAggregatorServiceName = "accesscontrol.basicroleaggregator"

// NoopBasicRoleAggregator is a no-op implementation of the basic-role
// aggregator for OSS builds. It is always disabled so the module manager
// registers an empty module that resolves immediately. Enterprise provides the
// real implementation via Wire, which overwrites this module in the dskit
// module manager.
type NoopBasicRoleAggregator struct {
	services.NamedService
}

func ProvideNoopBasicRoleAggregator() *NoopBasicRoleAggregator {
	var (
		startingFn = func(ctx context.Context) error { return nil }
		stoppingFn = func(failureCase error) error { return nil }
	)

	s := &NoopBasicRoleAggregator{}
	s.NamedService = services.NewIdleService(startingFn, stoppingFn).
		WithName(BasicRoleAggregatorServiceName)
	return s
}

// IsDisabled always returns true — OSS does not synthesise basic GlobalRoles
// from fixed-role permissions (Enterprise-only RBAC concept).
func (s *NoopBasicRoleAggregator) IsDisabled() bool { return true }

// Run satisfies the registry.BackgroundService interface.
func (s *NoopBasicRoleAggregator) Run(_ context.Context) error { return nil }
