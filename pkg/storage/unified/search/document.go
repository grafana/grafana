package search

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/stats"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// StandardDocumentBuilders provides the default list of document builders for open source Grafana.
// It combines the standard document builder with external builders for dashboards and users.
type StandardDocumentBuilders struct {
	sql       db.DB
	sprinkles builders.DashboardStats
}

func ProvideDocumentBuilders(sql db.DB, sprinkles builders.DashboardStats) resource.DocumentBuilderSupplier {
	return &StandardDocumentBuilders{sql, sprinkles}
}

// withDashboardStats returns a copy of the supplier that uses the given stats
// source for the dashboard document builder.
func (s *StandardDocumentBuilders) withDashboardStats(ds builders.DashboardStats) *StandardDocumentBuilders {
	return &StandardDocumentBuilders{sql: s.sql, sprinkles: ds}
}

// MaybeUseUnifiedStorageStats swaps the dashboard stats source to read from
// unified storage KV when [unified_storage] usage_stats_enabled is set and a KV
// store is available. Otherwise it returns docs unchanged (legacy source). This
// is the unified-storage usage-stats read path; it only affects the unified
// storage server's search document builders.
func MaybeUseUnifiedStorageStats(cfg *setting.Cfg, docs resource.DocumentBuilderSupplier, kvStore kv.KV) resource.DocumentBuilderSupplier {
	if cfg == nil || !cfg.EnableUnifiedStorageUsageStats || kvStore == nil {
		return docs
	}
	sdb, ok := docs.(*StandardDocumentBuilders)
	if !ok {
		return docs
	}
	return sdb.withDashboardStats(stats.NewKVDashboardStats(stats.NewStore(kvStore)))
}

func (s *StandardDocumentBuilders) GetDocumentBuilders() ([]resource.DocumentBuilderInfo, error) {
	all, err := builders.All(s.sql, s.sprinkles)
	if err != nil {
		return nil, err
	}

	result := []resource.DocumentBuilderInfo{ //nolint:prealloc
		{
			Builder: resource.StandardDocumentBuilder(resource.AppManifests()),
		},
	}
	return append(result, all...), nil
}
