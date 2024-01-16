package migration

import (
	"context"
	"fmt"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func (om *OrgMigration) migrateAlerts(ctx context.Context, alerts []*migrationStore.DashAlert, info migmodels.DashboardUpgradeInfo) ([]*AlertPair, error) {
	log := om.log.New(
		"dashboardUid", info.DashboardUID,
		"dashboardName", info.DashboardName,
		"newFolderUid", info.NewFolderUID,
		"newFolderNane", info.NewFolderName,
	)

	pairs := make([]*AlertPair, 0, len(alerts))
	for _, da := range alerts {
		al := log.New("ruleID", da.ID, "ruleName", da.Name)
		alertRule, err := om.migrateAlert(ctx, al, da, info)
		if err != nil {
			return nil, fmt.Errorf("migrate alert: %w", err)
		}
		pairs = append(pairs, &AlertPair{AlertRule: alertRule, DashAlert: da})
	}

	return pairs, nil
}

func (om *OrgMigration) migrateDashboard(ctx context.Context, dashID int64, alerts []*migrationStore.DashAlert) ([]*AlertPair, error) {
	info, err := om.migratedFolder(ctx, om.log, dashID)
	if err != nil {
		return nil, fmt.Errorf("get or create migrated folder: %w", err)
	}
	pairs, err := om.migrateAlerts(ctx, alerts, *info)
	if err != nil {
		return nil, fmt.Errorf("migrate and save alerts: %w", err)
	}

	return pairs, nil
}

func (om *OrgMigration) migrateOrgAlerts(ctx context.Context) ([]*AlertPair, error) {
	mappedAlerts, cnt, err := om.migrationStore.GetOrgDashboardAlerts(ctx, om.orgID)
	if err != nil {
		return nil, fmt.Errorf("load alerts: %w", err)
	}
	om.log.Info("Alerts found to migrate", "alerts", cnt)

	pairs := make([]*AlertPair, 0, cnt)
	for dashID, alerts := range mappedAlerts {
		dashPairs, err := om.migrateDashboard(ctx, dashID, alerts)
		if err != nil {
			return nil, fmt.Errorf("migrate and save dashboard '%d': %w", dashID, err)
		}
		pairs = append(pairs, dashPairs...)
	}
	return pairs, nil
}

func (om *OrgMigration) migrateOrgChannels(ctx context.Context, pairs []*AlertPair) (*apimodels.PostableUserConfig, error) {
	channels, err := om.migrationStore.GetNotificationChannels(ctx, om.orgID)
	if err != nil {
		return nil, fmt.Errorf("load notification channels: %w", err)
	}

	amConfig, err := om.migrateChannels(channels, pairs)
	if err != nil {
		return nil, err
	}

	return amConfig, nil
}

func (om *OrgMigration) migrateOrg(ctx context.Context) error {
	om.log.Info("Migrating alerts for organisation")

	pairs, err := om.migrateOrgAlerts(ctx)
	if err != nil {
		return fmt.Errorf("migrate alerts: %w", err)
	}

	// This must happen before we insert the rules into the database because it modifies the alert labels. This will
	// be changed in the future when we improve how notification policies are created.
	amConfig, err := om.migrateOrgChannels(ctx, pairs)
	if err != nil {
		return fmt.Errorf("migrate channels: %w", err)
	}

	if err := om.writeSilencesFile(); err != nil {
		return fmt.Errorf("write silence file for org %d: %w", om.orgID, err)
	}

	if len(pairs) > 0 {
		om.log.Debug("Inserting migrated alert rules", "count", len(pairs))
		rules := make([]models.AlertRule, 0, len(pairs))
		for _, p := range pairs {
			rules = append(rules, *p.AlertRule)
		}
		err := om.migrationStore.InsertAlertRules(ctx, rules...)
		if err != nil {
			return fmt.Errorf("insert alert rules: %w", err)
		}
	}

	if amConfig != nil {
		if err := om.migrationStore.SaveAlertmanagerConfiguration(ctx, om.orgID, amConfig); err != nil {
			return err
		}
	}

	return nil
}
