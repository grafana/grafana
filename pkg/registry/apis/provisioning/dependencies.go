package provisioning

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// DependencyRegisterer is set to satisfy wire gen and make sure the `RegisterDependencies` is called.
type DependencyRegisterer struct{}

func RegisterDependencies(
	features featuremgmt.FeatureToggles,
	accessControlService accesscontrol.Service,
) (*DependencyRegisterer, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagProvisioning) {
		return &DependencyRegisterer{}, nil
	}

	if err := registerAccessControlRoles(accessControlService); err != nil {
		return nil, fmt.Errorf("registering access control roles: %w", err)
	}

	return &DependencyRegisterer{}, nil
}
