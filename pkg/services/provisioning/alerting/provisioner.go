package alerting

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

type ProvisionerConfig struct {
	Path                 string
	DashboardService     dashboards.DashboardService
	DashboardProvService dashboards.DashboardProvisioningService
	RuleService          provisioning.AlertRuleService
	ContactPointService  provisioning.ContactPointService
}

func Provision(ctx context.Context, cfg ProvisionerConfig) error {
	logger := log.New("provisioning.alerting")
	cfgReader := newRulesConfigReader(logger)
	files, err := cfgReader.readConfig(ctx, cfg.Path)
	if err != nil {
		return err
	}
	logger.Info("starting to provision alerting")
	logger.Debug("read all alerting files", "file_count", len(files))
	ruleProvisioner := NewAlertRuleProvisioner(
		logger,
		cfg.DashboardService,
		cfg.DashboardProvService,
		cfg.RuleService)
	err = ruleProvisioner.Provision(ctx, files)
	if err != nil {
		return err
	}
	cpProvisioner := NewContactPointProvisoner(logger, cfg.ContactPointService)
	err = cpProvisioner.Provision(ctx, files)
	if err != nil {
		return err
	}
	// TODO: provision notificiation policy in between so that when applying it
	//       new objects already exists and old ones are still there
	err = cpProvisioner.Unprovision(ctx, files)
	if err != nil {
		return err
	}
	logger.Info("finished to provision alerting")
	return nil
}
