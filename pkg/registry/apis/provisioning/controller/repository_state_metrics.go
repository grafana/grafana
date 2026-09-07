package controller

import (
	"github.com/prometheus/client_golang/prometheus"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// repositoryStateMetrics exposes the observed state of each repository as
// per-repository gauges, refreshed on every reconcile from the object already in
// hand. Series are labelled by namespace+name so they are identical across
// replicas (every replica re-lists the full fleet on resync); dashboards dedupe
// with `max by (...)` across replica/pod target labels. Series must be deleted
// when a repository goes away, otherwise a repo deleted while a replica was not
// its event owner would leak a stale gauge forever.
type repositoryStateMetrics struct {
	info             *prometheus.GaugeVec
	managedResources *prometheus.GaugeVec
	health           *prometheus.GaugeVec
	lastSync         *prometheus.GaugeVec
}

func registerRepositoryStateMetrics(registry prometheus.Registerer) *repositoryStateMetrics {
	info := prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "grafana_provisioning_repository_info",
		Help: "A metric with a constant value of 1 for each provisioning repository, labelled by its type and sync target.",
	}, []string{"namespace", "name", "type", "target"})

	managedResources := prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "grafana_provisioning_repository_managed_resources",
		Help: "Number of resources managed by a repository, by group and resource, as of its last sync.",
	}, []string{"namespace", "name", "group", "resource"})

	health := prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "grafana_provisioning_repository_health",
		Help: "Current health of a provisioning repository (1 = healthy, 0 = unhealthy).",
	}, []string{"namespace", "name"})

	lastSync := prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "grafana_provisioning_repository_last_sync_timestamp_seconds",
		Help: "Unix timestamp (seconds) of when the repository's last sync finished.",
	}, []string{"namespace", "name"})

	registry.MustRegister(info, managedResources, health, lastSync)

	return &repositoryStateMetrics{
		info:             info,
		managedResources: managedResources,
		health:           health,
		lastSync:         lastSync,
	}
}

// Record refreshes all per-repository gauges from the reconciled object. It is
// nil-safe so tests and CRUD-only wiring can pass a nil recorder.
func (m *repositoryStateMetrics) Record(obj *provisioning.Repository) {
	if m == nil {
		return
	}

	namespace := obj.GetNamespace()
	name := obj.GetName()

	m.info.With(prometheus.Labels{
		"namespace": namespace,
		"name":      name,
		"type":      string(obj.Spec.Type),
		"target":    string(obj.Spec.Sync.Target),
	}).Set(1)

	healthy := 0.0
	if obj.Status.Health.Healthy {
		healthy = 1.0
	}
	m.health.WithLabelValues(namespace, name).Set(healthy)

	// Status.Sync.Finished is milliseconds; expose it as seconds. Leave it unset
	// when a sync has never finished so "time since last sync" panels don't report
	// a bogus 1970 timestamp.
	if obj.Status.Sync.Finished > 0 {
		m.lastSync.WithLabelValues(namespace, name).Set(float64(obj.Status.Sync.Finished) / 1000.0)
	} else {
		m.lastSync.DeletePartialMatch(prometheus.Labels{"namespace": namespace, "name": name})
	}

	// Clear stale per-kind series first so a resource kind that dropped out of
	// Status.Stats (e.g. count fell to zero) does not linger, then re-publish the
	// current counts.
	m.managedResources.DeletePartialMatch(prometheus.Labels{"namespace": namespace, "name": name})
	for _, stat := range obj.Status.Stats {
		m.managedResources.With(prometheus.Labels{
			"namespace": namespace,
			"name":      name,
			"group":     stat.Group,
			"resource":  stat.Resource,
		}).Set(float64(stat.Count))
	}
}

// Delete removes every series for a repository. It is nil-safe.
func (m *repositoryStateMetrics) Delete(namespace, name string) {
	if m == nil {
		return
	}
	labels := prometheus.Labels{"namespace": namespace, "name": name}
	m.info.DeletePartialMatch(labels)
	m.managedResources.DeletePartialMatch(labels)
	m.health.DeletePartialMatch(labels)
	m.lastSync.DeletePartialMatch(labels)
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
