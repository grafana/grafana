package folders

import "github.com/prometheus/client_golang/prometheus"

// Fixed label values keep the metric's cardinality bounded.
const (
	deleteCheckAllowed            = "allowed"
	deleteCheckRefusedNotEmpty    = "refused_not_empty"
	deleteCheckRefusedCountFailed = "refused_count_failed"
	deleteCheckBypassedForce      = "bypassed_force_delete"
	blockingKindNone              = "none"
)

// deleteCheckMetrics counts folder delete checks. A nil value records nothing.
type deleteCheckMetrics struct {
	checks     *prometheus.CounterVec
	legacyJoin string
}

// legacyJoinEnabled is a label so "allowed" with legacy_join="disabled" flags deletes decided
// without the legacy database.
func newDeleteCheckMetrics(reg prometheus.Registerer, legacyJoinEnabled bool) *deleteCheckMetrics {
	if reg == nil {
		return nil
	}
	checks := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_folder_delete_checks_total",
		Help: "Folder delete checks, by outcome, whether counting joined the legacy database, and the resource kind that blocked the delete",
	}, []string{"outcome", "legacy_join", "blocking_kind"})
	reg.MustRegister(checks)
	join := "disabled"
	if legacyJoinEnabled {
		join = "enabled"
	}
	return &deleteCheckMetrics{checks: checks, legacyJoin: join}
}

func (m *deleteCheckMetrics) record(outcome, blockingKind string) {
	if m == nil {
		return
	}
	m.checks.WithLabelValues(outcome, m.legacyJoin, blockingKind).Inc()
}
