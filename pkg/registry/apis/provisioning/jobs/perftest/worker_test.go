package perftest

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

func enabledFunc(v bool) func(context.Context) bool {
	return func(context.Context) bool { return v }
}

func testJob(d time.Duration, progressUpdates int) provisioning.Job {
	return provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionTest,
			Test: &provisioning.TestJobOptions{
				Duration:        metav1.Duration{Duration: d},
				ProgressUpdates: progressUpdates,
			},
		},
	}
}

func TestWorker_IsSupported(t *testing.T) {
	t.Run("supported when enabled and action is test", func(t *testing.T) {
		require.True(t, NewWorker(enabledFunc(true)).IsSupported(context.Background(), testJob(time.Second, 0)))
	})

	t.Run("not supported when disabled", func(t *testing.T) {
		require.False(t, NewWorker(enabledFunc(false)).IsSupported(context.Background(), testJob(time.Second, 0)))
	})

	t.Run("not supported for other actions", func(t *testing.T) {
		job := provisioning.Job{Spec: provisioning.JobSpec{Action: provisioning.JobActionPull}}
		require.False(t, NewWorker(enabledFunc(true)).IsSupported(context.Background(), job))
	})
}

func TestWorker_Process(t *testing.T) {
	t.Run("sleeps for the duration then completes", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		// 80ms can't deliver the default count without out-pacing the throttle, so
		// the total is clamped to 1.
		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("Record", mock.Anything, mock.Anything).Return().Maybe()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
		progress.On("SetFinalMessage", mock.Anything, mock.Anything).Return()

		start := time.Now()
		err := NewWorker(enabledFunc(true)).Process(context.Background(), nil, testJob(80*time.Millisecond, 0), progress)
		require.NoError(t, err)
		require.GreaterOrEqual(t, time.Since(start), 80*time.Millisecond)
	})

	t.Run("caps progress updates that out-pace the throttle", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		// 50ms / 3 is far tighter than the throttle, so the total is clamped to 1.
		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("Record", mock.Anything, mock.Anything).Return().Maybe()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
		progress.On("SetFinalMessage", mock.Anything, mock.Anything).Return()

		err := NewWorker(enabledFunc(true)).Process(context.Background(), nil, testJob(50*time.Millisecond, 3), progress)
		require.NoError(t, err)
	})

	t.Run("honors configured progress updates when the duration allows", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		// 2 updates over 4× the interval are deliverable, so the count is honored.
		// Cancel early; SetTotal is recorded before the loop starts.
		progress.On("SetTotal", mock.Anything, 2).Return()
		progress.On("Record", mock.Anything, mock.Anything).Return().Maybe()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()

		duration := 4 * jobs.NotifyThrottleInterval
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
		defer cancel()

		err := NewWorker(enabledFunc(true)).Process(ctx, nil, testJob(duration, 2), progress)
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})

	t.Run("records results so progress advances", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetTotal", mock.Anything, 2).Return()
		// Each tick must Record a result; without it JobStatus.Progress stays 0.
		progress.On("Record", mock.Anything, mock.Anything).Return()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
		progress.On("SetFinalMessage", mock.Anything, mock.Anything).Return()

		// 2 updates over 4× the interval: both ticks fire before completion.
		err := NewWorker(enabledFunc(true)).Process(context.Background(), nil, testJob(4*jobs.NotifyThrottleInterval, 2), progress)
		require.NoError(t, err)
	})

	t.Run("missing test options", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		job := provisioning.Job{Spec: provisioning.JobSpec{Action: provisioning.JobActionTest}}
		err := NewWorker(enabledFunc(true)).Process(context.Background(), nil, job, progress)
		require.Error(t, err)
	})

	t.Run("non-positive duration", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		err := NewWorker(enabledFunc(true)).Process(context.Background(), nil, testJob(0, 0), progress)
		require.Error(t, err)
	})

	t.Run("honors context cancellation", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetTotal", mock.Anything, defaultProgressUpdates).Return()
		progress.On("Record", mock.Anything, mock.Anything).Return().Maybe()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()

		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
		defer cancel()

		err := NewWorker(enabledFunc(true)).Process(ctx, nil, testJob(10*time.Second, 0), progress)
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})
}
