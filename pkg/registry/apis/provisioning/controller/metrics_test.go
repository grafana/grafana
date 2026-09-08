package controller

import (
	"errors"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// reconcileErrorCount returns the value of the reconcile-error counter for a
// specific {phase, cause} label pair, or 0 if that series was never recorded.
// counterValue only reads the first series, so a label-aware lookup is needed to
// distinguish user- from system-caused failures.
func reconcileErrorCount(t *testing.T, reg *prometheus.Registry, phase, cause string) float64 {
	t.Helper()
	family, ok := gatherMetrics(t, reg)["grafana_provisioning_repository_reconcile_errors_total"]
	if !ok {
		return 0
	}
	for _, m := range family.GetMetric() {
		labels := map[string]string{}
		for _, l := range m.GetLabel() {
			labels[l.GetName()] = l.GetValue()
		}
		if labels["phase"] == phase && labels["cause"] == cause {
			return m.GetCounter().GetValue()
		}
	}
	return 0
}

// TestRepositoryController_recordReconcileError verifies that reconcile failures
// are counted under the phase they occurred in and classified as user- or
// system-caused, so SLOs can exclude the user-caused ones (e.g. revoked
// credentials) that are surfaced on status rather than returned.
func TestRepositoryController_recordReconcileError(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	rc := &RepositoryController{reconcileMetrics: registerReconcileErrorMetrics(reg)}

	// User-caused: revoked or insufficient credentials, wrapped as the callers wrap them.
	rc.recordReconcileError(reconcilePhaseDelete, fmt.Errorf("execute deletion hooks: %w", repository.ErrPermissionDenied))
	rc.recordReconcileError(reconcilePhaseBuild, fmt.Errorf("create repository from configuration: %w", repository.ErrUnauthorized))
	// System-caused: anything not attributable to the user.
	rc.recordReconcileError(reconcilePhaseHook, errors.New("boom"))

	assert.Equal(t, 1.0, reconcileErrorCount(t, reg, reconcilePhaseDelete, reconcileCauseUser))
	assert.Equal(t, 1.0, reconcileErrorCount(t, reg, reconcilePhaseBuild, reconcileCauseUser))
	assert.Equal(t, 1.0, reconcileErrorCount(t, reg, reconcilePhaseHook, reconcileCauseSystem))
	// A system failure must not be miscounted as user-caused (which an SLO would ignore).
	assert.Equal(t, 0.0, reconcileErrorCount(t, reg, reconcilePhaseHook, reconcileCauseUser))
}

func TestReconcileErrorMetrics_NilSafe(t *testing.T) {
	var metrics *reconcileErrorMetrics
	assert.NotPanics(t, func() {
		metrics.RecordReconcileError(reconcilePhaseDelete, reconcileCauseUser)
	})
}
