// Package stats is a POC implementation of generic unified-storage usage
// stats: ingest resource events (views/queries/errors), accumulate them in
// memory, flush to KV under a lease, recompute rolling windows daily, and
// expose aggregates to the search index.
//
// See unified-storage-stats-design.md for the full design. This package
// implements Phase 1 (ingest + store + daily recalc + search read path).
package stats

import "fmt"

// StatsDeclaration describes which metrics and windows a resource tracks.
// It is hard-coded (a contract shared by storage-api and search-api) and must
// only evolve additively: an old index must tolerate unknown fields.
type StatsDeclaration struct {
	Group    string
	Resource string
	// Metrics that may be recorded for this resource (e.g. view/query/error).
	Metrics []string
	// Rolling windows (in days) materialized into the aggregates cache.
	Windows []int
}

// GroupResource returns the "group/resource" identity for this declaration.
func (d StatsDeclaration) GroupResource() string {
	return d.Group + "/" + d.Resource
}

// HasMetric reports whether name is a valid metric for this resource.
func (d StatsDeclaration) HasMetric(name string) bool {
	for _, m := range d.Metrics {
		if m == name {
			return true
		}
	}
	return false
}

// dashboardsDeclaration is the only declaration wired up for the POC.
var dashboardsDeclaration = StatsDeclaration{
	Group:    "dashboard.grafana.app",
	Resource: "dashboards",
	Metrics:  []string{"view", "query", "error"},
	Windows:  []int{1, 7, 30},
}

// Declarations is the in-process registry of tracked resources, keyed by
// "group/resource".
type Declarations struct {
	byGR map[string]StatsDeclaration
}

// DefaultDeclarations returns the hard-coded set of tracked resources.
func DefaultDeclarations() *Declarations {
	d := &Declarations{byGR: map[string]StatsDeclaration{}}
	d.add(dashboardsDeclaration)
	return d
}

func (d *Declarations) add(decl StatsDeclaration) {
	d.byGR[decl.GroupResource()] = decl
}

// Lookup returns the declaration for a group/resource, if tracked.
func (d *Declarations) Lookup(group, resource string) (StatsDeclaration, bool) {
	decl, ok := d.byGR[group+"/"+resource]
	return decl, ok
}

// MaxWindow returns the largest window (in days) across all declarations.
// Daily buckets older than this fold into the overflow bucket.
const MaxWindow = 30

// aggregateField returns the aggregates-cache field name for a metric/window,
// e.g. ("view", 7) -> "view_last_7_days". The legacy schema uses
// "_last_1_days" rather than "_today", so last_1 is identical to today.
func aggregateField(metric string, window int) string {
	return fmt.Sprintf("%s_last_%d_days", metric, window)
}

// totalField returns the cumulative field name for a metric, e.g.
// ("view") -> "view_total". total = overflow + sum(daily buckets), so it is
// fully reconcilable.
func totalField(metric string) string {
	return metric + "_total"
}
