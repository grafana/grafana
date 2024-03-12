package migration

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/migration/legacymodels"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

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

	om.deduplicateTitles(ctx, pairs)

	return pairs
}

// deduplicateTitles ensures that the alert rule titles are internally unique within folders.
func (om *OrgMigration) deduplicateTitles(ctx context.Context, pairs []*migmodels.AlertPair) {
	titleDedups := make(map[string]*migmodels.Deduplicator)
	for _, pair := range pairs {
		if pair.Rule == nil || pair.Error != nil {
			continue
		}
		if _, ok := titleDedups[pair.Rule.NamespaceUID]; !ok {
			titleDedups[pair.Rule.NamespaceUID] = migmodels.NewDeduplicator(om.migrationStore.CaseInsensitive(), store.AlertDefinitionMaxTitleLength)
		}

		l := om.log.FromContext(ctx).New("legacyRuleId", pair.LegacyRule.ID, "ruleUid", pair.Rule.UID)

		// Here we ensure that the alert rule title is unique within the folder.
		titleDeduplicator := titleDedups[pair.Rule.NamespaceUID]
		name, err := titleDeduplicator.Deduplicate(pair.Rule.Title)
		if err != nil {
			pair.Error = err
		}
		if name != pair.Rule.Title {
			l.Info("Alert rule title modified to be unique within folder", "old", pair.Rule.Title, "new", name)
			pair.Rule.Title = name
		}
	}
}
