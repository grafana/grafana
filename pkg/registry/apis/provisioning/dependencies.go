package provisioning

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// DependencyRegisterer is set to satisfy wire gen and make sure the `RegisterDependencies` is called.
type DependencyRegisterer struct{}

func RegisterDependencies(
	cfg *setting.Cfg,
	accessControlService accesscontrol.Service,
	features featuremgmt.FeatureToggles,
) (*DependencyRegisterer, error) {
	if err := registerAccessControlRoles(accessControlService); err != nil {
		return nil, fmt.Errorf("registering access control roles: %w", err)
	}

	return &DependencyRegisterer{}, nil
}
