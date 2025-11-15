package reconcilers

import (
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/prometheus/client_golang/prometheus"
)

// ReconcilerMetrics holds all the metrics for the IAM folder reconciler
type ReconcilerMetrics struct {
	// Comprehensive reconcile operations counter with labels for action, status, and detailed outcome
	ReconcileOperations *prometheus.CounterVec
}

// NewReconcilerMetrics creates a new set of metrics for the reconciler
func NewReconcilerMetrics(registerer prometheus.Registerer, namespace string) *ReconcilerMetrics {
	// Labels for comprehensive reconcile tracking
	operationLabels := []string{"action", "outcome"}
	operationValues := map[string][]string{
		"action": {"create", "update", "delete", "unknown"},
		"outcome": {
			"success_changes_made",
			"success_no_changes_needed",
			"failure_informer",
			"failure_permission_store",
			"failure_unknown",
		},
	}

	metrics := &ReconcilerMetrics{
		ReconcileOperations: metricutil.NewCounterVecStartingAtZero(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "iam_folder_reconciler",
				Name:      "folder_reconcile_operations_total",
				Help:      "Total number of folder reconcile operations by action and outcome",
			},
			operationLabels,
			operationValues,
		),
	}

	// Register the metric
	if registerer != nil {
		registerer.MustRegister(
			metrics.ReconcileOperations,
		)
	}

	return metrics
}

// RecordReconcileSuccess records a successful reconcile operation
func (m *ReconcilerMetrics) RecordReconcileSuccess(action, result string) {
	if m.ReconcileOperations != nil {
		// Validate parameters
		if action == "" || result == "" {
			return
		}
		outcome := "success_" + result // result should be "changes_made" or "no_changes_needed"
		m.ReconcileOperations.WithLabelValues(action, outcome).Inc()
	}
}

// RecordReconcileFailure records a failed reconcile operation
func (m *ReconcilerMetrics) RecordReconcileFailure(action, source string) {
	if m.ReconcileOperations != nil {
		// Validate parameters
		if action == "" || source == "" {
			return
		}
		outcome := "failure_" + source // source should be "informer", "permission_store", "folder_store", or "unknown"
		m.ReconcileOperations.WithLabelValues(action, outcome).Inc()
	}
}
