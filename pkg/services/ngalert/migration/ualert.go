package migration

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
)

func (om *OrgMigration) migrateAlerts(ctx context.Context, l log.Logger, alerts []*legacymodels.Alert, dashboard *dashboards.Dashboard, newFolderUID string) ([]*migmodels.AlertPair, error) {
	pairs := make([]*migmodels.AlertPair, 0, len(alerts))
	for _, da := range alerts {
		al := l.New("ruleId", da.ID, "ruleName", da.Name)

		alertRule, err := om.migrateAlert(ctx, al, da, dashboard, newFolderUID)
		if err != nil {
			return nil, fmt.Errorf("migrate alert '%s': %w", da.Name, err)
		}

		pairs = append(pairs, &migmodels.AlertPair{
			LegacyRule: da,
			Rule:       alertRule,
		})
	}

	return pairs, nil
}

func (om *OrgMigration) migrateDashboard(ctx context.Context, dashboard *dashboards.Dashboard, alerts []*legacymodels.Alert) (*migmodels.DashboardUpgrade, error) {
	du := &migmodels.DashboardUpgrade{
		ID:    dashboard.ID,
		UID:   dashboard.UID,
		Title: dashboard.Title,
		// nolint:staticcheck
		FolderID:       dashboard.FolderID,
		MigratedAlerts: make(map[int64]*migmodels.AlertPair),
	}

	l := om.log.New(
		"dashboardTitle", dashboard.Title,
		"dashboardUid", dashboard.UID,
	)
	l.Info("Migrating alerts for dashboard", "alertCount", len(alerts))
	alertFolder, created, err := om.migratedFolder(ctx, om.log, dashboard)
	if err != nil {
		return nil, fmt.Errorf("get or create migrated folder: %w", err)
	}
	du.NewFolderUID = alertFolder.UID
	du.CreatedFolder = created

	pairs, err := om.migrateAlerts(ctx, l, alerts, dashboard, alertFolder.UID)
	if err != nil {
		return nil, err
	}

	for _, pair := range pairs {
		du.MigratedAlerts[pair.LegacyRule.PanelID] = pair
	}
	return du, nil
}

func (om *OrgMigration) migrateOrgAlerts(ctx context.Context) ([]*migmodels.DashboardUpgrade, error) {
	mappedAlerts, cnt, err := om.migrationStore.GetOrgDashboardAlerts(ctx, om.orgID)
	if err != nil {
		return nil, fmt.Errorf("load alerts: %w", err)
	}
	om.log.Info("Alerts found to migrate", "alerts", cnt)

	dashboardUpgrades := make([]*migmodels.DashboardUpgrade, 0, len(mappedAlerts))
	for dashID, alerts := range mappedAlerts {
		dash, err := om.migrationStore.GetDashboard(ctx, om.orgID, dashID)
		if err != nil {
			return nil, fmt.Errorf("get dashboard '%d': %w", dashID, err)
		}
		du, err := om.migrateDashboard(ctx, dash, alerts)
		if err != nil {
			return nil, fmt.Errorf("migrate dashboard '%d': %w", dashID, err)
		}
		dashboardUpgrades = append(dashboardUpgrades, du)
	}
	return dashboardUpgrades, nil
}

func (om *OrgMigration) migrateOrgChannels(ctx context.Context) ([]*migmodels.ContactPair, error) {
	channels, err := om.migrationStore.GetNotificationChannels(ctx, om.orgID)
	if err != nil {
		return nil, fmt.Errorf("load notification channels: %w", err)
	}

	// Cache for later use by alerts
	om.channelCache.LoadChannels(channels)

	pairs, err := om.migrateChannels(channels)
	if err != nil {
		return nil, err
	}
	return pairs, nil
}

func (om *OrgMigration) migrateOrg(ctx context.Context) ([]*migmodels.DashboardUpgrade, []*migmodels.ContactPair, error) {
	om.log.Info("Migrating alerts for organisation")
	pairs, err := om.migrateOrgChannels(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("migrate channels: %w", err)
	}

	dashboardUpgrades, err := om.migrateOrgAlerts(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("migrate alerts: %w", err)
	}

	return dashboardUpgrades, pairs, nil
}
