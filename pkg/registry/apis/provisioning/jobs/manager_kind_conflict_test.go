package jobs

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestResourceResult_ManagerKindConflict(t *testing.T) {
	conflict := utils.NewResourceManagerKindConflictError(
		utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "terraform-provider"},
		utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "test-repo"},
	)
	for _, tt := range []struct {
		name    string
		err     error
		warning bool
	}{
		{"structured", conflict, true},
		{"legacy", &apierrors.StatusError{ErrStatus: metav1.Status{
			Code: 403, Reason: metav1.StatusReasonForbidden,
			Message: "Cannot change resource manager kind; remove the existing manager first, then add the new one",
		}}, true},
		{"unrelated forbidden", &apierrors.StatusError{ErrStatus: metav1.Status{
			Code: 403, Reason: metav1.StatusReasonForbidden, Message: "access denied",
		}}, false},
		{"identity conflict", &apierrors.StatusError{ErrStatus: metav1.Status{
			Code: 403, Reason: metav1.StatusReasonForbidden,
			Message: "Cannot change resource manager identity; remove the existing manager first, then add the new one",
		}}, false},
		{"server error", apierrors.NewInternalError(errors.New("storage unavailable")), false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			err := fmt.Errorf("writing resource from file dashboard.json: %w", tt.err)
			result := NewPathOnlyResult("dashboard.json").WithAction(repository.FileActionCreated).WithError(err).Build()
			if tt.warning {
				require.NoError(t, result.Error())
				require.ErrorIs(t, result.Warning(), tt.err)
				require.Equal(t, provisioning.ReasonResourceInvalid, result.WarningReason())
				require.False(t, isNonFailingWarning(result.Warning()))
			} else {
				require.ErrorIs(t, result.Error(), tt.err)
				require.NoError(t, result.Warning())
			}
		})
	}
}

func TestJobProcessor_ManagerKindConflict(t *testing.T) {
	conflict := utils.NewResourceManagerKindConflictError(
		utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "terraform-provider"},
		utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "test-repo"},
	)
	for _, tt := range []struct {
		name          string
		workerError   error
		resourceError error
		wantState     provisioning.JobState
	}{
		{name: "warning", wantState: provisioning.JobStateWarning},
		{name: "worker returns recorded warning", workerError: conflict, wantState: provisioning.JobStateWarning},
		{name: "worker warning and resource error", workerError: conflict, resourceError: errors.New("storage unavailable"), wantState: provisioning.JobStateError},
		{name: "worker error", workerError: errors.New("sync failed"), wantState: provisioning.JobStateError},
		{name: "resource error", resourceError: errors.New("storage unavailable"), wantState: provisioning.JobStateError},
		{name: "worker and resource errors", workerError: errors.New("sync failed"), resourceError: errors.New("storage unavailable"), wantState: provisioning.JobStateError},
	} {
		t.Run(tt.name, func(t *testing.T) {
			logger := newTestLogger()
			ctx := logging.Context(t.Context(), logger)
			job := makeTestJob("1")
			store := NewMockStore(t)
			store.EXPECT().Claim(mock.Anything, job.Namespace, job.Name, "0").Return(job, func() {}, nil).Once()
			store.EXPECT().Update(mock.Anything, mock.Anything).
				RunAndReturn(func(_ context.Context, job *provisioning.Job) (*provisioning.Job, error) {
					return job.DeepCopy(), nil
				})
			store.EXPECT().Complete(mock.Anything, mock.Anything).Return(nil).Once()
			history := NewMockHistoryWriter(t)
			var completed *provisioning.Job
			history.EXPECT().WriteJob(mock.Anything, mock.Anything).
				Run(func(_ context.Context, job *provisioning.Job) { completed = job.DeepCopy() }).Return(nil).Once()
			repo := repository.NewMockRepository(t)
			repo.On("Config").Return(makeRepoConfig("test-repo", nil, nil))
			repoGetter := NewMockRepoGetter(t)
			repoGetter.EXPECT().GetRepository(mock.Anything, job.Namespace, "test-repo").Return(repo, nil)

			worker := NewMockWorker(t)
			worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
			worker.EXPECT().Process(mock.Anything, repo, mock.Anything, mock.Anything).
				RunAndReturn(func(ctx context.Context, _ repository.Repository, _ provisioning.Job, progress JobProgressRecorder) error {
					progress.Record(ctx, NewGroupKindResult("conflicting", "dashboard.grafana.app", "Dashboard").
						WithPath("conflicting.json").WithAction(repository.FileActionCreated).
						WithError(fmt.Errorf("writing resource from file conflicting.json: %w", conflict)).Build())
					progress.Record(ctx, NewGroupKindResult("other", "dashboard.grafana.app", "Dashboard").
						WithPath("other.json").WithAction(repository.FileActionCreated).WithError(tt.resourceError).Build())
					return tt.workerError
				})
			metrics := &JobMetrics{
				processedTotal: prometheus.NewCounterVec(prometheus.CounterOpts{Name: "test_jobs_processed_total"}, []string{"action", "outcome"}),
				durationHist: prometheus.NewHistogramVec(prometheus.HistogramOpts{Name: "test_jobs_duration_seconds"},
					[]string{"action", "resources_changed_bucket", "outcome"}),
				resourceOpsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{Name: "test_resource_operations_total"},
					[]string{"action", "operation", "outcome", "reason", "group", "kind"}),
			}
			processor := newJobProcessor(time.Minute, time.Minute, store, repoGetter, history, "0", metrics, nil, worker)
			require.NoError(t, processor.processKey(ctx, job.Namespace, job.Name, triggerLive, time.Time{}))
			require.NotNil(t, completed)
			require.Equal(t, tt.wantState, completed.Status.State)
			require.Len(t, completed.Status.Warnings, 1)
			require.Contains(t, completed.Status.Warnings[0], conflict.Error())
			if tt.workerError != nil && tt.wantState == provisioning.JobStateError {
				require.Equal(t, tt.workerError.Error(), completed.Status.Message)
			}
			if tt.resourceError == nil {
				require.Empty(t, completed.Status.Errors)
			} else {
				require.Equal(t, []string{tt.resourceError.Error()}, completed.Status.Errors)
			}
			require.Equal(t, 1.0, testutil.ToFloat64(metrics.processedTotal.WithLabelValues("pull", string(tt.wantState))))
			require.Equal(t, 1.0, testutil.ToFloat64(metrics.resourceOpsTotal.WithLabelValues("pull", "created", "warning", provisioning.ReasonResourceInvalid, "dashboard.grafana.app", "Dashboard")))
			warningLogs := logger.GetWarnLogs()
			require.NotEmpty(t, warningLogs)
			require.Equal(t, "job resource operation completed with warning", warningLogs[0].msg)
			require.Contains(t, fmt.Sprint(warningLogs[0].fields), conflict.Error())
			if tt.wantState == provisioning.JobStateWarning {
				require.Empty(t, logger.GetErrorLogs())
				require.Equal(t, 0.0, testutil.ToFloat64(metrics.processedTotal.WithLabelValues("pull", "error")))
			}
		})
	}
}
