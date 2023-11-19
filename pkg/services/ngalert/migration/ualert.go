package migration

import (
	"context"
	"fmt"

	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func (om *OrgMigration) migrateAlerts(ctx context.Context, alerts []*legacymodels.Alert, info migmodels.DashboardUpgradeInfo) ([]models.AlertRule, error) {
	log := om.log.New(
		"dashboardUid", info.DashboardUID,
		"dashboardName", info.DashboardName,
		"newFolderUid", info.NewFolderUID,
		"newFolderNane", info.NewFolderName,
	)

	rules := make([]models.AlertRule, 0, len(alerts))
	for _, da := range alerts {
		al := log.New("ruleID", da.ID, "ruleName", da.Name)
		alertRule, err := om.migrateAlert(ctx, al, da, info)
		if err != nil {
			return nil, fmt.Errorf("migrate alert '%s': %w", da.Name, err)
		}
		rules = append(rules, *alertRule)
	}

	return rules, nil
}

func (om *OrgMigration) migrateDashboard(ctx context.Context, dashID int64, alerts []*legacymodels.Alert) ([]models.AlertRule, error) {
	info, err := om.migratedFolder(ctx, om.log, dashID)
	if err != nil {
		return nil, fmt.Errorf("get or create migrated folder: %w", err)
	}
	rules, err := om.migrateAlerts(ctx, alerts, *info)
	if err != nil {
		return nil, fmt.Errorf("migrate and save alerts: %w", err)
	}

	return rules, nil
}

func (om *OrgMigration) migrateOrgAlerts(ctx context.Context) error {
	mappedAlerts, cnt, err := om.migrationStore.GetOrgDashboardAlerts(ctx, om.orgID)
	if err != nil {
		return fmt.Errorf("load alerts: %w", err)
	}
	om.log.Info("Alerts found to migrate", "alerts", cnt)

	for dashID, alerts := range mappedAlerts {
		rules, err := om.migrateDashboard(ctx, dashID, alerts)
		if err != nil {
			return fmt.Errorf("migrate and save dashboard '%d': %w", dashID, err)
		}

		if len(rules) > 0 {
			om.log.Debug("Inserting migrated alert rules", "count", len(rules))
			err := om.migrationStore.InsertAlertRules(ctx, rules...)
			if err != nil {
				return fmt.Errorf("insert alert rules: %w", err)
			}
		}
	}
	return nil
}

func (om *OrgMigration) migrateOrgChannels(ctx context.Context) (*migmodels.Alertmanager, error) {
	channels, err := om.migrationStore.GetNotificationChannels(ctx, om.orgID)
	if err != nil {
		return nil, fmt.Errorf("load notification channels: %w", err)
	}

	// Cache for later use by alerts
	om.channelCache.LoadChannels(channels)

	amConfig, err := om.migrateChannels(channels)
	if err != nil {
		return nil, err
	}
	return amConfig, nil
}

func (om *OrgMigration) migrateOrg(ctx context.Context) error {
	om.log.Info("Migrating alerts for organisation")

	amConfig, err := om.migrateOrgChannels(ctx)
	if err != nil {
		return fmt.Errorf("migrate channels: %w", err)
	}

	err = om.migrateOrgAlerts(ctx)
	if err != nil {
		return fmt.Errorf("migrate alerts: %w", err)
	}

	if err := om.writeSilencesFile(); err != nil {
		return fmt.Errorf("write silence file for org %d: %w", om.orgID, err)
	}

	if amConfig != nil {
		if err := om.migrationStore.SaveAlertmanagerConfiguration(ctx, om.orgID, amConfig.Config); err != nil {
			return err
		}
	}

	return nil
}
