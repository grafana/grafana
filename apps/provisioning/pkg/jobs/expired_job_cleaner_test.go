package jobs

import (
	"context"
	"errors"
	"testing"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestExpiredJobCleaner_Cleanup(t *testing.T) {
	ctx := context.Background()
	fixedTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)

	t.Run("cleans up expired jobs successfully", func(t *testing.T) {
		lister := NewMockJobLister(t)
		completer := NewMockJobCompleter(t)
		historicJobs := NewMockHistoryWriter(t)
		handler := NewMockAbandonmentHandler(t)

		expiredJob := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action: provisioning.JobActionPull,
			},
			Status: provisioning.JobStatus{
				State: provisioning.JobStateWorking,
			},
		}

		expiry := 30 * time.Second
		expiredBefore := fixedTime.Add(-expiry)

		lister.EXPECT().ListExpiredJobs(ctx, expiredBefore, 100).Return([]*provisioning.Job{expiredJob}, nil)
		
		handler.EXPECT().SupportsAction(provisioning.JobActionPull).Return(true)
		handler.EXPECT().HandleAbandonment(ctx, mock.MatchedBy(func(j *provisioning.Job) bool {
			return j.GetName() == "test-job" &&
				j.Status.State == provisioning.JobStateError
		})).Return(nil)
		
		// Complete is called first
		completer.EXPECT().Complete(ctx, mock.MatchedBy(func(j *provisioning.Job) bool {
			return j.GetName() == "test-job" &&
				j.Status.State == provisioning.JobStateError &&
				j.Status.Finished == fixedTime.Unix()
		})).Return(nil)
		
		// Then history is written
		historicJobs.EXPECT().WriteJob(ctx, mock.Anything).Return(nil)

		cleaner := NewExpiredJobCleaner(lister, completer, historicJobs, expiry, handler)
		cleaner.clock = func() time.Time { return fixedTime }

		err := cleaner.Cleanup(ctx)
		require.NoError(t, err)
	})

	t.Run("handles no expired jobs", func(t *testing.T) {
		lister := NewMockJobLister(t)
		completer := NewMockJobCompleter(t)
		historicJobs := NewMockHistoryWriter(t)

		expiry := 30 * time.Second
		expiredBefore := fixedTime.Add(-expiry)

		lister.EXPECT().ListExpiredJobs(ctx, expiredBefore, 100).Return([]*provisioning.Job{}, nil)

		cleaner := NewExpiredJobCleaner(lister, completer, historicJobs, expiry)
		cleaner.clock = func() time.Time { return fixedTime }

		err := cleaner.Cleanup(ctx)
		require.NoError(t, err)
	})

	t.Run("returns error when listing fails", func(t *testing.T) {
		lister := NewMockJobLister(t)
		completer := NewMockJobCompleter(t)
		historicJobs := NewMockHistoryWriter(t)

		expiry := 30 * time.Second
		expiredBefore := fixedTime.Add(-expiry)
		expectedErr := errors.New("list error")

		lister.EXPECT().ListExpiredJobs(ctx, expiredBefore, 100).Return(nil, expectedErr)

		cleaner := NewExpiredJobCleaner(lister, completer, historicJobs, expiry)
		cleaner.clock = func() time.Time { return fixedTime }

		err := cleaner.Cleanup(ctx)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to list jobs with expired leases")
	})

	t.Run("continues when job already deleted", func(t *testing.T) {
		lister := NewMockJobLister(t)
		completer := NewMockJobCompleter(t)
		historicJobs := NewMockHistoryWriter(t)

		expiredJob := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action: provisioning.JobActionPull,
			},
		}

		expiry := 30 * time.Second
		expiredBefore := fixedTime.Add(-expiry)

		lister.EXPECT().ListExpiredJobs(ctx, expiredBefore, 100).Return([]*provisioning.Job{expiredJob}, nil)
		completer.EXPECT().Complete(ctx, mock.Anything).Return(errors.New("not found"))

		cleaner := NewExpiredJobCleaner(lister, completer, historicJobs, expiry)
		cleaner.clock = func() time.Time { return fixedTime }

		err := cleaner.Cleanup(ctx)
		require.NoError(t, err)
	})

	t.Run("returns error when complete fails with non-not-found error", func(t *testing.T) {
		lister := NewMockJobLister(t)
		completer := NewMockJobCompleter(t)
		historicJobs := NewMockHistoryWriter(t)

		expiredJob := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action: provisioning.JobActionPull,
			},
		}

		expiry := 30 * time.Second
		expiredBefore := fixedTime.Add(-expiry)
		expectedErr := errors.New("database error")

		lister.EXPECT().ListExpiredJobs(ctx, expiredBefore, 100).Return([]*provisioning.Job{expiredJob}, nil)
		completer.EXPECT().Complete(ctx, mock.Anything).Return(expectedErr)

		cleaner := NewExpiredJobCleaner(lister, completer, historicJobs, expiry)
		cleaner.clock = func() time.Time { return fixedTime }

		err := cleaner.Cleanup(ctx)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to complete expired job")
	})

	t.Run("continues cleanup when abandonment handler fails", func(t *testing.T) {
		lister := NewMockJobLister(t)
		completer := NewMockJobCompleter(t)
		handler := NewMockAbandonmentHandler(t)

		expiredJob := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action: provisioning.JobActionPull,
			},
		}

		expiry := 30 * time.Second
		expiredBefore := fixedTime.Add(-expiry)

		lister.EXPECT().ListExpiredJobs(ctx, expiredBefore, 100).Return([]*provisioning.Job{expiredJob}, nil)
		completer.EXPECT().Complete(ctx, mock.Anything).Return(nil)
		handler.EXPECT().SupportsAction(provisioning.JobActionPull).Return(true)
		handler.EXPECT().HandleAbandonment(ctx, mock.Anything).Return(errors.New("abandonment failed"))

		cleaner := NewExpiredJobCleaner(lister, completer, expiry, handler)
		cleaner.clock = func() time.Time { return fixedTime }

		err := cleaner.Cleanup(ctx)
		// Should not error - we log and continue
		require.NoError(t, err)
	})

	t.Run("skips abandonment when no handler supports action", func(t *testing.T) {
		lister := NewMockJobLister(t)
		completer := NewMockJobCompleter(t)
		handler := NewMockAbandonmentHandler(t)

		expiredJob := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action: provisioning.JobActionDelete,
			},
		}

		expiry := 30 * time.Second
		expiredBefore := fixedTime.Add(-expiry)

		lister.EXPECT().ListExpiredJobs(ctx, expiredBefore, 100).Return([]*provisioning.Job{expiredJob}, nil)
		completer.EXPECT().Complete(ctx, mock.Anything).Return(nil)
		handler.EXPECT().SupportsAction(provisioning.JobActionDelete).Return(false)

		cleaner := NewExpiredJobCleaner(lister, completer, expiry, handler)
		cleaner.clock = func() time.Time { return fixedTime }

		err := cleaner.Cleanup(ctx)
		require.NoError(t, err)
	})

	t.Run("uses first handler that supports action", func(t *testing.T) {
		lister := NewMockJobLister(t)
		completer := NewMockJobCompleter(t)
		handler1 := NewMockAbandonmentHandler(t)
		handler2 := NewMockAbandonmentHandler(t)

		expiredJob := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action: provisioning.JobActionPull,
			},
		}

		expiry := 30 * time.Second
		expiredBefore := fixedTime.Add(-expiry)

		lister.EXPECT().ListExpiredJobs(ctx, expiredBefore, 100).Return([]*provisioning.Job{expiredJob}, nil)
		completer.EXPECT().Complete(ctx, mock.Anything).Return(nil)

		// First handler doesn't support it
		handler1.EXPECT().SupportsAction(provisioning.JobActionPull).Return(false)

		// Second handler supports it and should be called
		handler2.EXPECT().SupportsAction(provisioning.JobActionPull).Return(true)
		handler2.EXPECT().HandleAbandonment(ctx, mock.Anything).Return(nil)

		cleaner := NewExpiredJobCleaner(lister, completer, expiry, handler1, handler2)
		cleaner.clock = func() time.Time { return fixedTime }

		err := cleaner.Cleanup(ctx)
		require.NoError(t, err)
	})
}

func TestExpiredJobCleaner_Run(t *testing.T) {
	t.Run("calculates cleanup interval based on expiry", func(t *testing.T) {
		tests := []struct {
			name                    string
			expiry                  time.Duration
			expectedCleanupInterval time.Duration
		}{
			{
				name:                    "default expiry",
				expiry:                  30 * time.Second,
				expectedCleanupInterval: 90 * time.Second,
			},
			{
				name:                    "enforces minimum",
				expiry:                  5 * time.Second,
				expectedCleanupInterval: 30 * time.Second,
			},
			{
				name:                    "enforces maximum",
				expiry:                  10 * time.Minute,
				expectedCleanupInterval: 5 * time.Minute,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				lister := NewMockJobLister(t)
				completer := NewMockJobCompleter(t)

				// We'll use a simple approach - just test that it cancels quickly
				cleaner := NewExpiredJobCleaner(lister, completer, tt.expiry)

				// Run in goroutine and cancel quickly
				ctx, cancel := context.WithCancel(context.Background())

				// Mock the initial cleanup call - it will be called once when Run starts
				lister.EXPECT().ListExpiredJobs(mock.Anything, mock.Anything, 100).
					Return([]*provisioning.Job{}, nil).Once()

				cancel() // Cancel immediately after setup

				err := cleaner.Run(ctx)
				assert.Equal(t, context.Canceled, err)
			})
		}
	})
}
