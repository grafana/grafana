package folders

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Fixed label values keep the metric's cardinality bounded.
const (
	deleteCheckAllowed              = "allowed"
	deleteCheckRefusedNotEmpty      = "refused_not_empty"
	deleteCheckRefusedCountFailed   = "refused_count_failed"
	deleteCheckRefusedCountCanceled = "refused_count_canceled"
	deleteCheckBypassedForce        = "bypassed_force_delete"
	blockingKindNone                = "none"
)

// deleteCheckMetrics counts folder delete checks. A nil value records nothing.
type deleteCheckMetrics struct {
	checks     *prometheus.CounterVec
	legacyJoin string
	dryRun     string
}

// legacyJoinEnabled is a label so "allowed" with legacy_join="disabled" flags deletes decided
// without the legacy database. dry_run separates checks that delete nothing, so they don't skew
// "allowed", while backend failures stay visible either way.
func newDeleteCheckMetrics(reg prometheus.Registerer, legacyJoinEnabled bool) *deleteCheckMetrics {
	checks := promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_folder_delete_checks_total",
		Help: "Folder delete checks, by outcome, whether counting joined the legacy database, the resource kind that blocked the delete, and whether it was a dry run",
	}, []string{"outcome", "legacy_join", "blocking_kind", "dry_run"})
	join := "disabled"
	if legacyJoinEnabled {
		join = "enabled"
	}
	// Created up front so rate() alerts see the first failure. refused_not_empty is left out because
	// it only exists with the kind that blocked the delete.
	for _, outcome := range []string{deleteCheckAllowed, deleteCheckRefusedCountFailed, deleteCheckRefusedCountCanceled, deleteCheckBypassedForce} {
		for _, dryRun := range []string{"false", "true"} {
			checks.WithLabelValues(outcome, join, blockingKindNone, dryRun).Add(0)
		}
	}
	return &deleteCheckMetrics{checks: checks, legacyJoin: join, dryRun: "false"}
}

// withDryRun returns a recorder that labels its samples with the request's dry-run flag.
func (m *deleteCheckMetrics) withDryRun(dryRun bool) *deleteCheckMetrics {
	if m == nil {
		return nil
	}
	c := *m
	c.dryRun = "false"
	if dryRun {
		c.dryRun = "true"
	}
	return &c
}

func (m *deleteCheckMetrics) record(outcome, blockingKind string) {
	if m == nil {
		return
	}
	m.checks.WithLabelValues(outcome, m.legacyJoin, blockingKind, m.dryRun).Inc()
}
