package alerting

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

type ProvisionerConfig struct {
	Path                       string
	DashboardService           dashboards.DashboardService
	DashboardProvService       dashboards.DashboardProvisioningService
	RuleService                provisioning.AlertRuleService
	ContactPointService        provisioning.ContactPointService
	NotificiationPolicyService provisioning.NotificationPolicyService
	MuteTimingService          provisioning.MuteTimingService
	TemplateService            provisioning.TemplateService
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
		return fmt.Errorf("alert rules: %w", err)
	}
	cpProvisioner := NewContactPointProvisoner(logger, cfg.ContactPointService)
	err = cpProvisioner.Provision(ctx, files)
	if err != nil {
		return fmt.Errorf("contact points: %w", err)
	}
	mtProvisioner := NewMuteTimesProvisioner(logger, cfg.MuteTimingService)
	err = mtProvisioner.Provision(ctx, files)
	if err != nil {
		return fmt.Errorf("mute times: %w", err)
	}
	ttProvsioner := NewTextTemplateProvisioner(logger, cfg.TemplateService)
	err = ttProvsioner.Provision(ctx, files)
	if err != nil {
		return fmt.Errorf("text templates: %w", err)
	}
	npProvisioner := NewNotificationPolicyProvisoner(logger, cfg.NotificiationPolicyService)
	err = npProvisioner.Provision(ctx, files)
	if err != nil {
		return fmt.Errorf("notification policies: %w", err)
	}
	err = npProvisioner.Unprovision(ctx, files)
	if err != nil {
		return fmt.Errorf("notification policies: %w", err)
	}
	err = cpProvisioner.Unprovision(ctx, files)
	if err != nil {
		return fmt.Errorf("contact points: %w", err)
	}
	err = mtProvisioner.Unprovision(ctx, files)
	if err != nil {
		return fmt.Errorf("mute times: %w", err)
	}
	err = ttProvsioner.Unprovision(ctx, files)
	if err != nil {
		return fmt.Errorf("text templates: %w", err)
	}
	logger.Info("finished to provision alerting")
	return nil
}
