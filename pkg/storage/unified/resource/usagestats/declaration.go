// Package usagestats implements generic unified-storage usage stats: a per-object
// daily bucket store (the source of truth) plus a derived rolling-window
// aggregates cache that the search index can read.
//
// This file declares which metrics and windows a resource tracks, and the
// analytics Store (see store.go) provides the CRUD interface over the
// stats/daily and stats/aggregates KV sections.
package usagestats

import "fmt"

const (
	dashboardsGroup    = "dashboard.grafana.app"
	dashboardsResource = "dashboards"
)

// StatsDeclaration describes which metrics and windows a resource tracks.
// It is hard-coded (a contract shared by storage-api and search-api) and must
// only evolve additively: an old index must tolerate unknown fields.
type StatsDeclaration struct {
	Group    string
	Resource string
	Metrics  []string
	Windows  []int
}

func (d StatsDeclaration) GroupResource() string {
	return d.Group + "/" + d.Resource
}

func (d StatsDeclaration) HasMetric(name string) bool {
	for _, m := range d.Metrics {
		if m == name {
			return true
		}
	}
	return false
}

var dashboardsDeclaration = StatsDeclaration{
	Group:    dashboardsGroup,
	Resource: dashboardsResource,
	// Metric names match the legacy dashboard_usage_* schema (and the search
	// index field prefixes), so aggregate fields come out as views_total,
	// views_last_7_days, etc.
	Metrics: []string{"views", "queries", "errors"},
	Windows: []int{1, 7, 30},
}

type Declarations struct {
	byGR map[string]StatsDeclaration
}

func DefaultDeclarations() *Declarations {
	d := &Declarations{byGR: map[string]StatsDeclaration{}}
	d.add(dashboardsDeclaration)
	return d
}

func (d *Declarations) add(decl StatsDeclaration) {
	d.byGR[decl.GroupResource()] = decl
}

func (d *Declarations) Lookup(group, resource string) (StatsDeclaration, bool) {
	decl, ok := d.byGR[group+"/"+resource]
	return decl, ok
}

// MaxWindow returns the largest window (in days) across all declarations.
// Daily buckets older than this fold into the overflow bucket.
const MaxWindow = 30

func aggregateField(metric string, window int) string {
	return fmt.Sprintf("%s_last_%d_days", metric, window)
}

func totalField(metric string) string {
	return metric + "_total"
}
