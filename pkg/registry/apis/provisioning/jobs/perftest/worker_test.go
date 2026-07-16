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

func testJob(d time.Duration) provisioning.Job {
	return provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionTest,
			Test:   &provisioning.TestJobOptions{Duration: metav1.Duration{Duration: d}},
		},
	}
}

func TestWorker_IsSupported(t *testing.T) {
	t.Run("supported when enabled and action is test", func(t *testing.T) {
		require.True(t, NewWorker(true).IsSupported(context.Background(), testJob(time.Second)))
	})

	t.Run("not supported when disabled", func(t *testing.T) {
		require.False(t, NewWorker(false).IsSupported(context.Background(), testJob(time.Second)))
	})

	t.Run("not supported for other actions", func(t *testing.T) {
		job := provisioning.Job{Spec: provisioning.JobSpec{Action: provisioning.JobActionPull}}
		require.False(t, NewWorker(true).IsSupported(context.Background(), job))
	})
}

func TestWorker_Process(t *testing.T) {
	t.Run("sleeps for the duration then completes", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetTotal", mock.Anything, mock.Anything).Return()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
		progress.On("SetFinalMessage", mock.Anything, mock.Anything).Return()

		start := time.Now()
		err := NewWorker(true).Process(context.Background(), nil, testJob(80*time.Millisecond), progress)
		require.NoError(t, err)
		require.GreaterOrEqual(t, time.Since(start), 80*time.Millisecond)
	})

	t.Run("missing test options", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		job := provisioning.Job{Spec: provisioning.JobSpec{Action: provisioning.JobActionTest}}
		err := NewWorker(true).Process(context.Background(), nil, job, progress)
		require.Error(t, err)
	})

	t.Run("non-positive duration", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		err := NewWorker(true).Process(context.Background(), nil, testJob(0), progress)
		require.Error(t, err)
	})

	t.Run("honors context cancellation", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetTotal", mock.Anything, mock.Anything).Return()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()

		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
		defer cancel()

		err := NewWorker(true).Process(ctx, nil, testJob(10*time.Second), progress)
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})
}
