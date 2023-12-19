package migration

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
)

func (om *OrgMigration) migrateAlerts(ctx context.Context, l log.Logger, alerts []*legacymodels.Alert, dashboard *dashboards.Dashboard) ([]*migmodels.AlertPair, error) {
	pairs := make([]*migmodels.AlertPair, 0, len(alerts))
	for _, da := range alerts {
		al := l.New("ruleId", da.ID, "ruleName", da.Name)

		alertRule, err := om.migrateAlert(ctx, al, da, dashboard)
		if err != nil {
			if om.failOnError {
				return nil, fmt.Errorf("migrate alert '%s': %w", da.Name, err)
			}
			al.Warn("Failed to migrate alert", "error", err)
			pairs = append(pairs, migmodels.NewAlertPair(da, err))
			continue
		}

		pair := migmodels.NewAlertPair(da, nil)
		pair.Rule = alertRule
		pairs = append(pairs, pair)
	}

	return pairs, nil
}

func (om *OrgMigration) migrateDashboard(ctx context.Context, dashID int64, alerts []*legacymodels.Alert) (*migmodels.DashboardUpgrade, error) {
	dashboard, err := om.migrationStore.GetDashboard(ctx, om.orgID, dashID)
	if err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			// Historically, orphaned alerts are an exception to failOnError. We can revisit this if necessary.
			om.log.Warn("Dashboard not found, alerts are orphaned", "dashboardId", dashID, "alertCount", len(alerts))
			du := migmodels.NewDashboardUpgrade(dashID)
			du.AddAlertErrors(dashboards.ErrDashboardNotFound, alerts...)
			return du, nil
		}
		return nil, fmt.Errorf("get dashboard '%d': %w", dashID, err)
	}
	l := om.log.New(
		"dashboardTitle", dashboard.Title,
		"dashboardUid", dashboard.UID,
	)
	l.Info("Migrating alerts for dashboard", "alertCount", len(alerts))

	du := migmodels.NewDashboardUpgrade(dashID)
	du.UID = dashboard.UID
	du.Title = dashboard.Title
	// nolint:staticcheck
	du.FolderID = dashboard.FolderID

	pairs, err := om.migrateAlerts(ctx, l, alerts, dashboard)
	if err != nil {
		if om.failOnError {
			return nil, err
		}
		l.Warn("Failed to migrate dashboard alerts", "alertCount", len(alerts), "error", err)
		du.AddAlertErrors(err, alerts...)
		return du, nil
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
		du, err := om.migrateDashboard(ctx, dashID, alerts)
		if err != nil && om.failOnError {
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
