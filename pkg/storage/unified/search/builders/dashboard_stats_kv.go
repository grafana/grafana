package builders

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	dashV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// KVDashboardStats implements DashboardStats by reading per-dashboard counters
// from the ResourceKV store. Stats are keyed by the dashboard's metadata.name,
// which is what DashboardDocumentBuilder uses to look them up.
//
// Source: owner "usageinsights.grafana.app", key "stats".
// The prototype hard-wires this mapping in Go — CUE source.kv declarations
// come in a later phase.
//
// Bad JSON or a missing field is treated as absent (debug log, no error).
// One owner's bad data can't break the kind's indexing.
type KVDashboardStats struct {
	store *kv.ResourceKVStore
	log   log.Logger
}

// NewKVDashboardStats creates a KVDashboardStats backed by the given store.
// Returns nil when store is nil; callers can pass nil without a prior check.
func NewKVDashboardStats(store *kv.ResourceKVStore) *KVDashboardStats {
	if store == nil {
		return nil
	}
	return &KVDashboardStats{
		store: store,
		log:   log.New("kv-dashboard-stats"),
	}
}

var _ DashboardStats = (*KVDashboardStats)(nil)

const (
	kvStatsOwner = "usageinsights.grafana.app"
	kvStatsKey   = "stats"
)

// kvStatsFields is the set of numeric field names we extract from the stats
// document. All of them map 1:1 to the existing dashboard search constants.
var kvStatsFields = []string{
	DASHBOARD_VIEWS_TOTAL,
	DASHBOARD_VIEWS_TODAY,
	DASHBOARD_VIEWS_LAST_1_DAYS,
	DASHBOARD_VIEWS_LAST_7_DAYS,
	DASHBOARD_VIEWS_LAST_30_DAYS,
	DASHBOARD_QUERIES_TOTAL,
	DASHBOARD_QUERIES_TODAY,
	DASHBOARD_QUERIES_LAST_1_DAYS,
	DASHBOARD_QUERIES_LAST_7_DAYS,
	DASHBOARD_QUERIES_LAST_30_DAYS,
	DASHBOARD_ERRORS_TOTAL,
	DASHBOARD_ERRORS_TODAY,
	DASHBOARD_ERRORS_LAST_1_DAYS,
	DASHBOARD_ERRORS_LAST_7_DAYS,
	DASHBOARD_ERRORS_LAST_30_DAYS,
}

// GetStats scans all KV entries for dashboards in namespace and returns
// map[name → map[field → value]]. The key is the dashboard's metadata.name,
// matching how DashboardDocumentBuilder indexes stats (dashboard.go).
//
// Only the "stats" document under owner "usageinsights.grafana.app" is
// processed. Missing data results in an absent field, not an error.
func (s *KVDashboardStats) GetStats(ctx context.Context, namespace string) (map[string]map[string]int64, error) {
	gvr := dashV1.DashboardResourceInfo.GroupVersionResource()
	items, err := s.store.ScanNamespace(ctx, gvr.Group, gvr.Resource, namespace)
	if err != nil {
		return nil, fmt.Errorf("kv dashboard stats scan namespace %q: %w", namespace, err)
	}

	result := make(map[string]map[string]int64, len(items))
	for _, item := range items {
		if item.Owner != kvStatsOwner || item.Key != kvStatsKey {
			continue
		}

		var doc map[string]interface{}
		if err := json.Unmarshal(item.Value, &doc); err != nil {
			s.log.Debug("skipping kv stats entry with invalid JSON",
				"namespace", namespace, "name", item.Name, "error", err)
			continue
		}

		fields := extractKVStatsFields(doc)
		if len(fields) == 0 {
			continue
		}

		if result[item.Name] == nil {
			result[item.Name] = make(map[string]int64, len(fields))
		}
		for k, v := range fields {
			result[item.Name][k] = v
		}
	}
	return result, nil
}

// GetDashboardStats returns the stats for a single dashboard by name via a
// point read (owner "usageinsights.grafana.app", key "stats"), not a
// namespace scan — the vector backfiller calls this once per dashboard
// (backfill/backfiller.go), so scanning the whole namespace on every call
// would be O(namespace size) per dashboard instead of O(1).
//
// Returns nil, nil (absent, no error) when the entry does not exist or its
// value is not a JSON object, matching GetStats' drift handling.
func (s *KVDashboardStats) GetDashboardStats(ctx context.Context, namespace, name string) (map[string]int64, error) {
	gvr := dashV1.DashboardResourceInfo.GroupVersionResource()
	p := kv.ResourceParent{
		Group:     gvr.Group,
		Resource:  gvr.Resource,
		Namespace: namespace,
		Name:      name,
	}
	value, _, _, err := s.store.Get(ctx, p, kvStatsOwner, kvStatsKey)
	if err != nil {
		if errors.Is(err, kv.ErrNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("kv dashboard stats get %q/%q: %w", namespace, name, err)
	}

	var doc map[string]interface{}
	if err := json.Unmarshal(value, &doc); err != nil {
		s.log.Debug("skipping kv stats entry with invalid JSON",
			"namespace", namespace, "name", name, "error", err)
		return nil, nil
	}
	return extractKVStatsFields(doc), nil
}

// extractKVStatsFields extracts numeric fields from a JSON document.
// JSON numbers decode as float64; we coerce them to int64.
// Fields that are absent or of an unexpected type are silently omitted.
func extractKVStatsFields(doc map[string]interface{}) map[string]int64 {
	var out map[string]int64
	for _, name := range kvStatsFields {
		raw, ok := doc[name]
		if !ok {
			continue
		}
		var v int64
		switch typed := raw.(type) {
		case float64:
			v = int64(typed)
		case int64:
			v = typed
		default:
			continue
		}
		if out == nil {
			out = make(map[string]int64)
		}
		out[name] = v
	}
	return out
}
