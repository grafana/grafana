// Package usagestats implements generic unified-storage usage stats: a per-object
// daily bucket store (the source of truth) plus a derived rolling-window
// aggregates cache that the search index can read.
//
// This file declares which metrics and windows a resource tracks, and the
// analytics Store (see store.go) provides the CRUD interface over the
// stats/daily and stats/aggregates KV sections.
package usagestats

import (
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

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

// fieldNames is the aggregate-field vocabulary derived from a declaration.
// Building the names costs a string allocation each, and both the flush and the
// reconcile path would otherwise rebuild the same handful of strings for every
// object they touch, so they are built once per declaration instead.
type fieldNames struct {
	// metricIndex maps a metric to its position in decl.Metrics, which is the
	// index used by totals and windows below.
	metricIndex map[string]int
	totals      []string   // [metric]
	windows     [][]string // [metric][window], windows in decl.Windows order
}

func newFieldNames(decl StatsDeclaration) *fieldNames {
	f := &fieldNames{
		metricIndex: make(map[string]int, len(decl.Metrics)),
		totals:      make([]string, len(decl.Metrics)),
		windows:     make([][]string, len(decl.Metrics)),
	}
	for i, metric := range decl.Metrics {
		f.metricIndex[metric] = i
		f.totals[i] = totalField(metric)
		f.windows[i] = make([]string, len(decl.Windows))
		for j, w := range decl.Windows {
			f.windows[i][j] = aggregateField(metric, w)
		}
	}
	return f
}

// declaration pairs a declaration with the field names derived from it. The
// names are built at registration time and never mutated, so every reader shares
// them without synchronization.
type declaration struct {
	StatsDeclaration
	fields *fieldNames
}

// index returns a metric's position in the declaration, or false if the metric
// is not declared.
func (d declaration) index(metric string) (int, bool) {
	i, ok := d.fields.metricIndex[metric]
	return i, ok
}

func (d declaration) hasMetric(metric string) bool {
	_, ok := d.fields.metricIndex[metric]
	return ok
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
	byGR map[string]declaration
}

func DefaultDeclarations() *Declarations {
	d := newDeclarations()
	d.add(dashboardsDeclaration)
	return d
}

func newDeclarations() *Declarations {
	return &Declarations{byGR: map[string]declaration{}}
}

// add is the only way into the registry, which is what guarantees every
// declaration carries its derived field names.
func (d *Declarations) add(decl StatsDeclaration) {
	d.byGR[decl.GroupResource()] = declaration{StatsDeclaration: decl, fields: newFieldNames(decl)}
}

func (d *Declarations) lookup(group, resource string) (declaration, bool) {
	decl, ok := d.byGR[group+"/"+resource]
	return decl, ok
}

// all returns every declared resource. The order is unspecified.
func (d *Declarations) all() []declaration {
	out := make([]declaration, 0, len(d.byGR))
	for _, decl := range d.byGR {
		out = append(out, decl)
	}
	return out
}

func (d *Declarations) Validate() error {
	for _, decl := range d.byGR {
		if len(decl.Metrics) > kv.MaxBatchOps {
			return fmt.Errorf("resource %s declares %d metrics, exceeding the max batch size of %d",
				decl.GroupResource(), len(decl.Metrics), kv.MaxBatchOps)
		}
		// Buckets older than MaxWindow days are folded into the overflow bucket,
		// which has no day, so a longer window could never be computed.
		for _, w := range decl.Windows {
			if w < 1 || w > MaxWindow {
				return fmt.Errorf("resource %s declares a %d day window, outside the supported range 1..%d",
					decl.GroupResource(), w, MaxWindow)
			}
		}
	}
	return nil
}

// MaxWindow is the largest window (in days) a declaration may ask for, and the
// number of daily buckets kept per object: anything older folds into the
// overflow bucket.
const MaxWindow = 30

func aggregateField(metric string, window int) string {
	return fmt.Sprintf("%s_last_%d_days", metric, window)
}

func totalField(metric string) string {
	return metric + "_total"
}
