package provisioning

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/leaderelection/clusterlease"
	"github.com/grafana/grafana/pkg/infra/log"
)

// newControllerElector returns the elector that gates a standalone provisioning
// operator so only one replica runs its controller. Leader election is opt-in via
// the [provisioning] leader_election setting: when enabled it elects a single leader
// on leaseName via a coordination ClusterLease; otherwise it falls back to
// always-leader — every replica runs the controller, the historical behavior.
// Enabling it requires the coordination.grafana.app API to be served (by the
// aggregated API server).
func newControllerElector(controllerCfg *ControllerConfig, leaseName string) (leaderelection.Elector, error) {
	if !controllerCfg.Settings.SectionWithEnvOverrides("provisioning").Key("leader_election").MustBool(false) {
		return leaderelection.NewDefaultElector(), nil
	}

	restCfg, err := controllerCfg.CoordinationRestConfig()
	if err != nil {
		return nil, fmt.Errorf("build coordination rest config: %w", err)
	}
	return clusterlease.New(restCfg, leaderelection.Config{LeaseName: leaseName}, log.New("provisioning-leaderelection"))
}
