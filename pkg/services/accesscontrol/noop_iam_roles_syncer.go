package accesscontrol

import (
	"context"

	"github.com/grafana/dskit/services"
)

// IAMRolesSyncerServiceName is the service name used by both the noop and
// the real (enterprise) IAMRolesSyncer so the module dependency graph can
// reference it by a stable key.
const IAMRolesSyncerServiceName = "accesscontrol.iamrolessyncer"

// NoopIAMRolesSyncer is a no-op implementation of the IAM roles syncer for
// OSS builds. It is always disabled so the module manager registers an empty
// module that resolves immediately, satisfying the FixedRolesLoader dependency.
// Enterprise provides the real implementation via Wire which overwrites this
// module in the dskit module manager.
type NoopIAMRolesSyncer struct {
	services.NamedService
}

func ProvideNoopIAMRolesSyncer() *NoopIAMRolesSyncer {
	s := &NoopIAMRolesSyncer{}
	s.NamedService = services.NewIdleService(nil, nil).
		WithName(IAMRolesSyncerServiceName)
	return s
}

// IsDisabled always returns true — OSS has no IAM app to fetch roles from.
func (s *NoopIAMRolesSyncer) IsDisabled() bool { return true }

// Run satisfies the registry.BackgroundService interface.
func (s *NoopIAMRolesSyncer) Run(_ context.Context) error {
	return nil
}
