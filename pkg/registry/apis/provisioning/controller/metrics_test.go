package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/nanogit/protocol/client"
)

func TestReconcileErrorMetrics_NilSafe(t *testing.T) {
	var metrics *reconcileErrorMetrics
	assert.NotPanics(t, func() {
		metrics.RecordReconcileError(reconcilePhaseDelete, reconcileCauseUser)
	})
}

func TestHealthCheckMetrics(t *testing.T) {
	type testCase struct {
		name        string
		result      *provisioning.TestResults
		err         error
		wantOutcome string
		wantCause   string
	}
	tests := []testCase{ //nolint:prealloc // Keep the table literal readable alongside the generated status-code cases.
		{
			name:        "healthy",
			result:      &provisioning.TestResults{Success: true, Code: http.StatusOK},
			wantOutcome: "success",
			wantCause:   "",
		},
		{
			name:        "repository unauthorized",
			err:         repository.ErrUnauthorized,
			wantOutcome: "error",
			wantCause:   "user",
		},
		{
			name:        "repository permission denied",
			err:         repository.ErrPermissionDenied,
			wantOutcome: "error",
			wantCause:   "user",
		},
		{
			name:        "connection authentication",
			err:         connection.ErrAuthentication,
			wantOutcome: "error",
			wantCause:   "user",
		},
		{
			name:        "connection not found",
			err:         connection.ErrNotFound,
			wantOutcome: "error",
			wantCause:   "user",
		},
		{
			name:        "connection repository access",
			err:         connection.ErrRepositoryAccess,
			wantOutcome: "error",
			wantCause:   "user",
		},
		{
			name: "production nanogit unauthorized",
			err: fmt.Errorf("list refs: list refs: send ls-refs command: %w",
				client.NewUnauthorizedError("POST", "git-upload-pack", errors.New("got status code 401: 401 Unauthorized"))),
			wantOutcome: "error",
			wantCause:   "user",
		},
		{
			name:        "nanogit permission denied",
			err:         client.NewPermissionDeniedError("POST", "git-upload-pack", nil),
			wantOutcome: "error",
			wantCause:   "user",
		},
		{
			name:        "nanogit server unavailable",
			err:         client.NewServerUnavailableError("POST", http.StatusServiceUnavailable, nil),
			wantOutcome: "error",
			wantCause:   "system",
		},
		{
			name:        "repository server unavailable",
			err:         repository.ErrServerUnavailable,
			wantOutcome: "error",
			wantCause:   "system",
		},
		{
			name:        "timeout",
			err:         context.DeadlineExceeded,
			wantOutcome: "error",
			wantCause:   "system",
		},
		{
			name:        "canceled",
			err:         context.Canceled,
			wantOutcome: "error",
			wantCause:   "system",
		},
		{
			name:        "unknown error",
			err:         errors.New("unexpected failure"),
			wantOutcome: "error",
			wantCause:   "system",
		},
		{
			name:        "unstructured unauthorized message",
			err:         errors.New("unauthorized (operation POST, endpoint git-upload-pack, status code 401): got status code 401: 401 Unauthorized"),
			wantOutcome: "error",
			wantCause:   "system",
		},
	}
	for _, code := range []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity, http.StatusServiceUnavailable} {
		tests = append(tests, testCase{
			name: fmt.Sprintf("unhealthy result %d", code),
			result: &provisioning.TestResults{
				Code:    code,
				Success: false,
				Errors:  []provisioning.ErrorDetails{{Detail: "repository unavailable"}},
			},
			wantOutcome: "success",
			wantCause:   "",
		})
	}

	for _, resource := range []string{"repository", "connection"} {
		t.Run(resource, func(t *testing.T) {
			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					reg := prometheus.NewPedanticRegistry()
					recorder := registerHealthMetrics(reg)
					existingStatus := provisioning.HealthStatus{Healthy: true, Checked: 1}
					testErr := tt.err
					if testErr != nil {
						testErr = fmt.Errorf("provider test: %w", testErr)
					}

					var (
						result *provisioning.TestResults
						status provisioning.HealthStatus
						err    error
					)
					if resource == "repository" {
						repo := &mockRepository{
							config:     &provisioning.Repository{},
							testResult: tt.result,
							testError:  testErr,
						}
						checker := NewRepositoryHealthChecker(nil, repository.NewTester(), recorder)
						result, status, err = checker.refreshHealth(context.Background(), repo, existingStatus)
					} else {
						conn := &provisioning.Connection{}
						tester := NewMockConnectionTester(t)
						tester.EXPECT().TestConnection(mock.Anything, conn).Return(tt.result, testErr).Once()
						checker := NewConnectionHealthChecker(tester, recorder)
						result, status, err = checker.refreshHealth(context.Background(), conn, existingStatus)
					}

					if tt.err != nil {
						require.ErrorIs(t, err, tt.err)
						assert.Nil(t, result)
						assert.Equal(t, existingStatus, status)
					} else {
						require.NoError(t, err)
						assert.Equal(t, tt.result, result)
						assert.Equal(t, tt.result.Success, status.Healthy)
						assert.Greater(t, status.Checked, existingStatus.Checked)
						if tt.result.Success {
							assert.Empty(t, status.Error)
							assert.Empty(t, status.Message)
						} else {
							assert.Equal(t, provisioning.HealthFailureHealth, status.Error)
							assert.Equal(t, []string{"repository unavailable"}, status.Message)
						}
					}

					families := gatherMetrics(t, reg)
					counter := families["grafana_provisioning_health_checked_total"]
					require.NotNil(t, counter)
					require.Len(t, counter.Metric, 1)
					assert.Equal(t, 1.0, counter.Metric[0].GetCounter().GetValue())
					labels := map[string]string{}
					for _, label := range counter.Metric[0].Label {
						labels[label.GetName()] = label.GetValue()
					}
					assert.Equal(t, map[string]string{"resource": resource, "outcome": tt.wantOutcome, "cause": tt.wantCause}, labels)

					duration := families["grafana_provisioning_health_checked_duration_seconds"]
					require.NotNil(t, duration)
					require.Len(t, duration.Metric, 1)
					require.Len(t, duration.Metric[0].Label, 1)
					assert.Equal(t, "resource", duration.Metric[0].Label[0].GetName())
					assert.Equal(t, resource, duration.Metric[0].Label[0].GetValue())
					assert.Equal(t, uint64(1), duration.Metric[0].GetHistogram().GetSampleCount())
					assert.GreaterOrEqual(t, duration.Metric[0].GetHistogram().GetSampleSum(), 0.0)
				})
			}
		})
	}
}

// processedCounterValue reads grafana_provisioning_events_processed_total for a
// resource and source.
func processedCounterValue(t *testing.T, reg *prometheus.Registry, resource, source string) float64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, mf := range families {
		if mf.GetName() != "grafana_provisioning_events_processed_total" {
			continue
		}
		for _, m := range mf.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			if labels["resource"] == resource && labels["source"] == source {
				return m.GetCounter().GetValue()
			}
		}
	}
	return 0
}

// assertOnlyProcessedTrigger asserts exactly wantTrigger advanced to 1 for the
// resource, the others staying at 0.
func assertOnlyProcessedTrigger(t *testing.T, reg *prometheus.Registry, resource, wantTrigger string) {
	t.Helper()
	for _, source := range []string{"live", "relist", "initial"} {
		want := 0.0
		if source == wantTrigger {
			want = 1.0
		}
		assert.Equal(t, want, processedCounterValue(t, reg, resource, source), "%s counter", source)
	}
}

// gaugeValueByName reads the single-sample gauge `name` from the gatherer.
func gaugeValueByName(t *testing.T, g prometheus.Gatherer, name string) float64 {
	t.Helper()
	mfs, err := g.Gather()
	require.NoError(t, err)
	for _, mf := range mfs {
		if mf.GetName() == name {
			require.Len(t, mf.GetMetric(), 1)
			return mf.GetMetric()[0].GetGauge().GetValue()
		}
	}
	t.Fatalf("metric %q not found", name)
	return 0
}

// histogramSampleCountByName reads the observation count of the histogram `name`.
func histogramSampleCountByName(t *testing.T, g prometheus.Gatherer, name string) uint64 {
	t.Helper()
	mfs, err := g.Gather()
	require.NoError(t, err)
	for _, mf := range mfs {
		if mf.GetName() == name {
			require.Len(t, mf.GetMetric(), 1)
			return mf.GetMetric()[0].GetHistogram().GetSampleCount()
		}
	}
	t.Fatalf("metric %q not found", name)
	return 0
}
