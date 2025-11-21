package migrations

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
)

type CountValidator struct {
	client         resourcepb.ResourceIndexClient
	legacyTableMap map[string]LegacyTableInfo
}

func NewCountValidator(client resourcepb.ResourceIndexClient, legacyTableMap map[string]LegacyTableInfo) Validator {
	return &CountValidator{client: client, legacyTableMap: legacyTableMap}
}

func (v *CountValidator) Validate(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error {
	if len(response.Rejected) > 0 {
		log.Warn("Migration had rejected items", "count", len(response.Rejected))
		for i, rejected := range response.Rejected {
			if i < 10 { // Log first 10 rejected items
				log.Warn("Rejected item",
					"namespace", rejected.Key.Namespace,
					"group", rejected.Key.Group,
					"resource", rejected.Key.Resource,
					"name", rejected.Key.Name,
					"reason", rejected.Error)
			}
		}
		// Rejections are not fatal - they may be expected for invalid data
	}

	// Validate counts for each resource type
	for _, summary := range response.Summary {
		key := fmt.Sprintf("%s/%s", summary.Group, summary.Resource)
		tableInfo, ok := v.legacyTableMap[key]
		if !ok {
			log.Debug("No legacy table mapping for resource, skipping count validation",
				"resource", fmt.Sprintf("%s.%s", summary.Resource, summary.Group),
				"namespace", summary.Namespace)
			continue
		}

		// Get legacy count from database
		orgID, err := ParseOrgIDFromNamespace(summary.Namespace)
		if err != nil {
			return fmt.Errorf("invalid namespace %s: %w", summary.Namespace, err)
		}

		legacyCount, err := sess.Table(tableInfo.Table).Where(tableInfo.WhereClause, orgID).Count()
		if err != nil {
			return fmt.Errorf("failed to count %s: %w", tableInfo.Table, err)
		}

		// Get unified storage count using GetStats API
		statsResp, err := v.client.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: summary.Namespace,
			Kinds:     []string{fmt.Sprintf("%s/%s", summary.Group, summary.Resource)},
		})
		if err != nil {
			return fmt.Errorf("failed to get stats for %s/%s in namespace %s: %w",
				summary.Group, summary.Resource, summary.Namespace, err)
		}

		// Find the count for this specific resource type
		var unifiedCount int64
		for _, stat := range statsResp.Stats {
			if stat.Group == summary.Group && stat.Resource == summary.Resource {
				unifiedCount = stat.Count
				break
			}
		}

		// Account for rejected items in validation
		expectedCount := unifiedCount + int64(len(response.Rejected))

		log.Info("Count validation",
			"resource", fmt.Sprintf("%s.%s", summary.Resource, summary.Group),
			"namespace", summary.Namespace,
			"legacy_count", legacyCount,
			"unified_count", unifiedCount,
			"migration_summary_count", summary.Count,
			"rejected", len(response.Rejected),
			"history", summary.History)

		// Validate that we migrated all items (allowing for rejected items)
		if legacyCount > expectedCount {
			return fmt.Errorf("count mismatch for %s.%s in namespace %s: legacy has %d, unified has %d, rejected %d",
				summary.Resource, summary.Group, summary.Namespace,
				legacyCount, unifiedCount, len(response.Rejected))
		}
	}

	return nil
}
