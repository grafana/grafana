package controller

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// repositoryStateMetrics aggregates observed repository state into low-cardinality
// fleet gauges. Per-repository state is kept in an in-memory map (keyed by
// namespace/name) that the reconcile loop refreshes; only aggregates -- counts by
// type and managed-resource totals by group/resource -- are exposed to Prometheus.
// The metric cardinality is therefore bounded by the number of repository types and
// resource kinds, never by the number of namespaces or repositories (which would be
// unbounded in the multi-tenant operator). Per-repository/per-namespace drill-down
// lives in the reconcile log line instead, where high cardinality is free.
//
// It is a prometheus.Collector: Collect recomputes the aggregates from the map at
// scrape time, so there are no stale series to clean up and no drift. Each replica
// keeps its own map; because every replica re-lists the full fleet on resync, the
// aggregates converge across replicas -- dashboards use `max by (...)` to dedupe.
type repositoryStateMetrics struct {
	mu    sync.RWMutex
	state map[string]repoSnapshot

	repositories *prometheus.Desc
	unhealthy    *prometheus.Desc
	managed      *prometheus.Desc
}

// repoSnapshot is the per-repository state we aggregate over. It is small and
// owned by the map (stats is copied on write), so nothing here aliases the
// informer cache.
type repoSnapshot struct {
	repoType string
	healthy  bool
	stats    []provisioning.ResourceCount
}

func registerRepositoryStateMetrics(registry prometheus.Registerer) *repositoryStateMetrics {
	m := &repositoryStateMetrics{
		state: make(map[string]repoSnapshot),
		repositories: prometheus.NewDesc(
			"grafana_provisioning_repositories",
			"Number of provisioning repositories, by type.",
			[]string{"type"}, nil,
		),
		unhealthy: prometheus.NewDesc(
			"grafana_provisioning_repositories_unhealthy",
			"Number of provisioning repositories currently unhealthy, by type.",
			[]string{"type"}, nil,
		),
		managed: prometheus.NewDesc(
			"grafana_provisioning_managed_resources",
			"Number of resources managed by provisioning repositories, by group and resource, as of each repository's last sync.",
			[]string{"group", "resource"}, nil,
		),
	}
	registry.MustRegister(m)
	return m
}

func repoStateKey(namespace, name string) string { return namespace + "/" + name }

// Record refreshes the stored snapshot for a repository from the reconciled
// object. It is nil-safe so tests and CRUD-only wiring can pass a nil recorder.
func (m *repositoryStateMetrics) Record(obj *provisioning.Repository) {
	if m == nil {
		return
	}

	// Copy the stats slice so the map does not alias the (possibly shared)
	// informer-cache object. ResourceCount is a value type, so a shallow copy
	// fully isolates it.
	stats := make([]provisioning.ResourceCount, len(obj.Status.Stats))
	copy(stats, obj.Status.Stats)

	m.mu.Lock()
	defer m.mu.Unlock()
	m.state[repoStateKey(obj.GetNamespace(), obj.GetName())] = repoSnapshot{
		repoType: string(obj.Spec.Type),
		healthy:  obj.Status.Health.Healthy,
		stats:    stats,
	}
}

// Delete forgets a repository's snapshot. It is nil-safe.
func (m *repositoryStateMetrics) Delete(namespace, name string) {
	if m == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.state, repoStateKey(namespace, name))
}

func (m *repositoryStateMetrics) Describe(ch chan<- *prometheus.Desc) {
	ch <- m.repositories
	ch <- m.unhealthy
	ch <- m.managed
}

func (m *repositoryStateMetrics) Collect(ch chan<- prometheus.Metric) {
	type kind struct{ group, resource string }

	byType := make(map[string]int)
	unhealthyByType := make(map[string]int)
	managedByKind := make(map[kind]int64)

	m.mu.RLock()
	for _, s := range m.state {
		byType[s.repoType]++
		if !s.healthy {
			unhealthyByType[s.repoType]++
		}
		for _, rc := range s.stats {
			managedByKind[kind{rc.Group, rc.Resource}] += rc.Count
		}
	}
	m.mu.RUnlock()

	// Emit repositories and unhealthy for every observed type so the unhealthy
	// series is present (0) even when a type has no unhealthy repositories,
	// avoiding gaps in dashboards and alerts.
	for t, n := range byType {
		ch <- prometheus.MustNewConstMetric(m.repositories, prometheus.GaugeValue, float64(n), t)
		ch <- prometheus.MustNewConstMetric(m.unhealthy, prometheus.GaugeValue, float64(unhealthyByType[t]), t)
	}
	for k, n := range managedByKind {
		ch <- prometheus.MustNewConstMetric(m.managed, prometheus.GaugeValue, float64(n), k.group, k.resource)
	}
}

// totalManagedResources sums the per-kind counts for a repository, for the
// per-reconcile summary log line.
func totalManagedResources(stats []provisioning.ResourceCount) int64 {
	var total int64
	for _, s := range stats {
		total += s.Count
	}
	return total
}
