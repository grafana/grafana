package migration

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
)

// ErrOrphanedAlert is used for legacy alerts that are missing their dashboard.
var ErrOrphanedAlert = errors.New("orphaned")

func (om *OrgMigration) migrateAlerts(ctx context.Context, l log.Logger, alerts []*legacymodels.Alert, dashboard *dashboards.Dashboard) []*migmodels.AlertPair {
	pairs := make([]*migmodels.AlertPair, 0, len(alerts))
	for _, da := range alerts {
		al := l.New("ruleId", da.ID, "ruleName", da.Name)

		alertRule, err := om.migrateAlert(ctx, al, da, dashboard)
		if err != nil {
			al.Warn("Failed to migrate alert", "error", err)
			pairs = append(pairs, migmodels.NewAlertPair(da, err))
			continue
		}

		pair := migmodels.NewAlertPair(da, nil)
		pair.Rule = alertRule
		pairs = append(pairs, pair)
	}

	return pairs
}

func (om *OrgMigration) migrateDashboard(ctx context.Context, dashID int64, alerts []*legacymodels.Alert) *migmodels.DashboardUpgrade {
	dashboard, err := om.migrationStore.GetDashboard(ctx, om.orgID, dashID)
	if err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			err = fmt.Errorf("%w: missing dashboard", ErrOrphanedAlert)
		}
		du := migmodels.NewDashboardUpgrade(dashID)
		du.AddAlertErrors(err, alerts...)
		return du
	}
	l := om.log.FromContext(ctx).New(
		"dashboardTitle", dashboard.Title,
		"dashboardUid", dashboard.UID,
	)
	l.Debug("Migrating alerts for dashboard", "alertCount", len(alerts))

	du := migmodels.NewDashboardUpgrade(dashID)
	du.UID = dashboard.UID
	du.Title = dashboard.Title
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.NGAlerts).Inc()
	// nolint:staticcheck
	du.FolderID = dashboard.FolderID

	pairs := om.migrateAlerts(ctx, l, alerts, dashboard)
	for _, pair := range pairs {
		du.MigratedAlerts[pair.LegacyRule.PanelID] = pair
	}
	return du
}

func (om *OrgMigration) migrateOrgAlerts(ctx context.Context) ([]*migmodels.DashboardUpgrade, error) {
	mappedAlerts, cnt, err := om.migrationStore.GetOrgDashboardAlerts(ctx, om.orgID)
	if err != nil {
		return nil, fmt.Errorf("load alerts: %w", err)
	}
	om.log.FromContext(ctx).Info("Alerts found to migrate", "alerts", cnt)

	dashboardUpgrades := make([]*migmodels.DashboardUpgrade, 0, len(mappedAlerts))
	for dashID, alerts := range mappedAlerts {
		du := om.migrateDashboard(ctx, dashID, alerts)
		dashboardUpgrades = append(dashboardUpgrades, du)
	}
	return dashboardUpgrades, nil
}

func (om *OrgMigration) migrateOrgChannels(ctx context.Context) ([]*migmodels.ContactPair, error) {
	channels, err := om.migrationStore.GetNotificationChannels(ctx, om.orgID)
	if err != nil {
		return nil, fmt.Errorf("load notification channels: %w", err)
	}

	pairs, err := om.migrateChannels(channels, om.log.FromContext(ctx))
	if err != nil {
		return nil, err
	}
	return pairs, nil
}

func (om *OrgMigration) migrateOrg(ctx context.Context) ([]*migmodels.DashboardUpgrade, []*migmodels.ContactPair, error) {
	om.log.FromContext(ctx).Info("Migrating alerts for organisation")
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
