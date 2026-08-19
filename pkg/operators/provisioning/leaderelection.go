package provisioning

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/leaderelection/clusterlease"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// Lease names for the standalone provisioning operators. Each operator type elects
// its own leader, so one replica of each runs its controller while the others stand
// by. They are distinct from the in-process "provisioning-controller" lease because a
// deployment runs either the in-process controllers or the standalone operators, not
// both.
const (
	repoControllerLeaseName       = "provisioning-repo-controller"
	connectionControllerLeaseName = "provisioning-connection-controller"
	jobControllerLeaseName        = "provisioning-job-controller"
)

// newControllerElector returns the elector that gates a standalone provisioning
// operator so only one replica runs its controller. When the coordination
// ClusterLease API is enabled it elects a single leader on leaseName; otherwise it
// falls back to always-leader — every replica runs the controller, the historical
// behavior — so enabling leader election is opt-in via the coordination feature.
func newControllerElector(controllerCfg *ControllerConfig, leaseName string) (leaderelection.Elector, error) {
	featureManager, err := featuremgmt.ProvideManagerService(controllerCfg.Settings)
	if err != nil {
		return nil, fmt.Errorf("create feature manager: %w", err)
	}
	features := featuremgmt.ProvideToggles(featureManager)

	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagCoordinationLeasesApi) {
		return leaderelection.NewDefaultElector(), nil
	}

	restCfg, err := controllerCfg.CoordinationRestConfig()
	if err != nil {
		return nil, fmt.Errorf("build coordination rest config: %w", err)
	}
	return clusterlease.New(restCfg, leaderelection.Config{LeaseName: leaseName}, log.New("provisioning-leaderelection"))
}
