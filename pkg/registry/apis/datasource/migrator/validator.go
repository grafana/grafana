package migrator

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// DataSourceCountValidator compares total data_source row count (per org) against
// the sum of unified storage counts across ALL datasource *.datasource.grafana.app groups.
type DataSourceCountValidator struct {
	client     resourcepb.ResourceIndexClient
	driverName string
}

func (v *DataSourceCountValidator) Name() string {
	return "DataSourceCountValidator"
}

func (v *DataSourceCountValidator) Validate(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error {
	if len(response.Summary) == 0 {
		log.Debug("No summaries found for datasources, skipping count validation")
		return nil
	}

	// All summaries share the same namespace (single org migration)
	namespace := response.Summary[0].Namespace
	orgID, err := migrations.ParseOrgIDFromNamespace(namespace)
	if err != nil {
		return fmt.Errorf("invalid namespace %s: %w", namespace, err)
	}

	// Get legacy count from data_source table
	legacyCount, err := sess.Table("data_source").Where("org_id = ?", orgID).Count()
	if err != nil {
		return fmt.Errorf("failed to count data_source: %w", err)
	}

	// Sum unified storage counts across all datasource groups from the bulk response summaries
	var unifiedCount int64
	var rejectedCount int64
	for _, summary := range response.Summary {
		if v.driverName == migrator.SQLite {
			count, err := sess.Table("resource").
				Where("namespace = ? AND `group` = ? AND resource = ?",
					summary.Namespace, summary.Group, summary.Resource).
				Count()
			if err != nil {
				return fmt.Errorf("failed to count resource table for %s/%s: %w",
					summary.Group, summary.Resource, err)
			}
			unifiedCount += count
		} else {
			statsResp, err := v.client.GetStats(ctx, &resourcepb.ResourceStatsRequest{
				Namespace: summary.Namespace,
				Kinds:     []string{fmt.Sprintf("%s/%s", summary.Group, summary.Resource)},
			})
			if err != nil {
				return fmt.Errorf("failed to get stats for %s/%s: %w",
					summary.Group, summary.Resource, err)
			}
			for _, stat := range statsResp.Stats {
				if stat.Group == summary.Group && stat.Resource == summary.Resource {
					unifiedCount += stat.Count
					break
				}
			}
		}
	}

	for _, rejected := range response.Rejected {
		if rejected.Key != nil {
			rejectedCount++
		}
	}

	expectedCount := unifiedCount + rejectedCount

	log.Info("DataSource count validation",
		"namespace", namespace,
		"legacy_count", legacyCount,
		"unified_count", unifiedCount,
		"rejected", rejectedCount,
		"summary_groups", len(response.Summary))

	if legacyCount > expectedCount {
		return fmt.Errorf("datasource count mismatch in namespace %s: legacy has %d, unified has %d, rejected %d",
			namespace, legacyCount, unifiedCount, rejectedCount)
	}

	return nil
}

// DataSourceCountValidation creates a ValidatorFactory for datasource count validation.
// Unlike the standard CountValidation, this aggregates counts across all plugin-specific
// datasource groups (*.datasource.grafana.app).
func DataSourceCountValidation() migrations.ValidatorFactory {
	return func(client resourcepb.ResourceIndexClient, driverName string) migrations.Validator {
		return &DataSourceCountValidator{
			client:     client,
			driverName: driverName,
		}
	}
}
