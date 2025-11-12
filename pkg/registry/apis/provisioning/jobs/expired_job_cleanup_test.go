package jobs

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestNewJobCleanupController(t *testing.T) {
	store := &MockStore{}
	historyWriter := &MockHistoryWriter{}

	t.Run("creates controller with default cleanup interval", func(t *testing.T) {
		expiry := 30 * time.Second
		controller := NewJobCleanupController(store, historyWriter, expiry)

		assert.NotNil(t, controller)
		assert.Equal(t, expiry, controller.expiry)
		// Cleanup interval should be 3x expiry = 90 seconds
		assert.Equal(t, 90*time.Second, controller.cleanupInterval)
	})

	t.Run("enforces minimum cleanup interval", func(t *testing.T) {
		// With expiry of 5 seconds, 3x = 15 seconds, but minimum is 30 seconds
		expiry := 5 * time.Second
		controller := NewJobCleanupController(store, historyWriter, expiry)

		assert.Equal(t, 30*time.Second, controller.cleanupInterval)
	})

	t.Run("enforces maximum cleanup interval", func(t *testing.T) {
		// With expiry of 5 minutes, 3x = 15 minutes, but maximum is 5 minutes
		expiry := 5 * time.Minute
		controller := NewJobCleanupController(store, historyWriter, expiry)

		assert.Equal(t, 5*time.Minute, controller.cleanupInterval)
	})
}

func TestJobCleanupController_Cleanup(t *testing.T) {
	t.Run("no expired jobs returns nil", func(t *testing.T) {
		store := &MockStore{}
		historyWriter := &MockHistoryWriter{}

		controller := NewJobCleanupController(store, historyWriter, 30*time.Second)
		ctx := context.Background()

		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).Return([]*provisioning.Job{}, nil)

		err := controller.Cleanup(ctx)

		assert.NoError(t, err)
		store.AssertExpectations(t)
		// store.AssertNotCalled(t, "Complete") - not needed with combined Store mock
		historyWriter.AssertNotCalled(t, "WriteJob")
	})

	t.Run("error listing expired jobs returns error", func(t *testing.T) {
		store := &MockStore{}
		
		historyWriter := &MockHistoryWriter{}

		controller := NewJobCleanupController(store, historyWriter, 30*time.Second)
		ctx := context.Background()

		expectedErr := errors.New("list failed")
		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).Return(nil, expectedErr)

		err := controller.Cleanup(ctx)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to list jobs with expired leases")
		store.AssertExpectations(t)
	})

	t.Run("successfully cleans up expired job", func(t *testing.T) {
		store := &MockStore{}
		
		historyWriter := &MockHistoryWriter{}

		controller := NewJobCleanupController(store, historyWriter, 30*time.Second)
		ctx := context.Background()

		job := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "test-ns",
				Labels: map[string]string{
					LabelJobClaim: "123456789",
				},
			},
			Spec: provisioning.JobSpec{
				Repository: "test-repo",
				Action:     provisioning.JobActionPull,
			},
		}

		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).Return([]*provisioning.Job{job}, nil)
		store.On("Complete", mock.Anything, mock.MatchedBy(func(j *provisioning.Job) bool {
			return j.Status.State == provisioning.JobStateError &&
				j.Status.Message == "Job failed due to lease expiry - worker may have crashed or lost connection"
		})).Return(nil)
		historyWriter.On("WriteJob", mock.Anything, mock.MatchedBy(func(j *provisioning.Job) bool {
			// Verify claim label was removed before writing to history
			_, hasLabel := j.Labels[LabelJobClaim]
			return !hasLabel && j.Status.State == provisioning.JobStateError
		})).Return(nil)

		err := controller.Cleanup(ctx)

		assert.NoError(t, err)
		store.AssertExpectations(t)
		store.AssertExpectations(t)
		historyWriter.AssertExpectations(t)
	})

	t.Run("continues on complete error", func(t *testing.T) {
		store := &MockStore{}
		
		historyWriter := &MockHistoryWriter{}

		controller := NewJobCleanupController(store, historyWriter, 30*time.Second)
		ctx := context.Background()

		job1 := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "job-1",
				Namespace: "test-ns",
				Labels:    map[string]string{LabelJobClaim: "123"},
			},
			Spec: provisioning.JobSpec{
				Repository: "repo-1",
				Action:     provisioning.JobActionPull,
			},
		}
		job2 := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "job-2",
				Namespace: "test-ns",
				Labels:    map[string]string{LabelJobClaim: "456"},
			},
			Spec: provisioning.JobSpec{
				Repository: "repo-2",
				Action:     provisioning.JobActionPull,
			},
		}

		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).Return([]*provisioning.Job{job1, job2}, nil)
		
		// First job fails to complete
		store.On("Complete", mock.Anything, mock.MatchedBy(func(j *provisioning.Job) bool {
			return j.Name == "job-1"
		})).Return(errors.New("complete failed"))
		
		// Second job succeeds
		store.On("Complete", mock.Anything, mock.MatchedBy(func(j *provisioning.Job) bool {
			return j.Name == "job-2"
		})).Return(nil)
		historyWriter.On("WriteJob", mock.Anything, mock.MatchedBy(func(j *provisioning.Job) bool {
			return j.Name == "job-2"
		})).Return(nil)

		err := controller.Cleanup(ctx)

		// Should not return error, continues processing
		assert.NoError(t, err)
		store.AssertExpectations(t)
		store.AssertExpectations(t)
		historyWriter.AssertExpectations(t)
	})

	t.Run("continues on history write error", func(t *testing.T) {
		store := &MockStore{}
		
		historyWriter := &MockHistoryWriter{}

		controller := NewJobCleanupController(store, historyWriter, 30*time.Second)
		ctx := context.Background()

		job := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "test-ns",
				Labels:    map[string]string{LabelJobClaim: "123"},
			},
			Spec: provisioning.JobSpec{
				Repository: "test-repo",
				Action:     provisioning.JobActionPull,
			},
		}

		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).Return([]*provisioning.Job{job}, nil)
		store.On("Complete", mock.Anything, mock.Anything).Return(nil)
		historyWriter.On("WriteJob", mock.Anything, mock.Anything).Return(errors.New("write failed"))

		err := controller.Cleanup(ctx)

		// Should not return error, just log warning
		assert.NoError(t, err)
		store.AssertExpectations(t)
		store.AssertExpectations(t)
		historyWriter.AssertExpectations(t)
	})

	t.Run("sets job status correctly", func(t *testing.T) {
		store := &MockStore{}
		
		historyWriter := &MockHistoryWriter{}

		fixedTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
		controller := NewJobCleanupController(store, historyWriter, 30*time.Second)
		controller.clock = func() time.Time { return fixedTime }
		ctx := context.Background()

		job := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "test-ns",
				Labels:    map[string]string{LabelJobClaim: "123"},
			},
			Spec: provisioning.JobSpec{
				Repository: "test-repo",
				Action:     provisioning.JobActionPull,
			},
		}

		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).Return([]*provisioning.Job{job}, nil)
		store.On("Complete", mock.Anything, mock.MatchedBy(func(j *provisioning.Job) bool {
			assert.Equal(t, provisioning.JobStateError, j.Status.State)
			assert.Equal(t, "Job failed due to lease expiry - worker may have crashed or lost connection", j.Status.Message)
			assert.Equal(t, fixedTime.Unix(), j.Status.Finished)
			return true
		})).Return(nil)
		historyWriter.On("WriteJob", mock.Anything, mock.Anything).Return(nil)

		err := controller.Cleanup(ctx)

		assert.NoError(t, err)
		store.AssertExpectations(t)
		store.AssertExpectations(t)
	})

	t.Run("removes claim label before writing to history", func(t *testing.T) {
		store := &MockStore{}
		
		historyWriter := &MockHistoryWriter{}

		controller := NewJobCleanupController(store, historyWriter, 30*time.Second)
		ctx := context.Background()

		job := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "test-ns",
				Labels: map[string]string{
					LabelJobClaim:    "123456789",
					"other-label":    "value",
				},
			},
			Spec: provisioning.JobSpec{
				Repository: "test-repo",
				Action:     provisioning.JobActionPull,
			},
		}

		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).Return([]*provisioning.Job{job}, nil)
		store.On("Complete", mock.Anything, mock.Anything).Return(nil)
		historyWriter.On("WriteJob", mock.Anything, mock.MatchedBy(func(j *provisioning.Job) bool {
			_, hasClaim := j.Labels[LabelJobClaim]
			_, hasOther := j.Labels["other-label"]
			assert.False(t, hasClaim, "claim label should be removed")
			assert.True(t, hasOther, "other labels should be preserved")
			return !hasClaim && hasOther
		})).Return(nil)

		err := controller.Cleanup(ctx)

		assert.NoError(t, err)
		historyWriter.AssertExpectations(t)
	})

	t.Run("processes multiple expired jobs", func(t *testing.T) {
		store := &MockStore{}
		
		historyWriter := &MockHistoryWriter{}

		controller := NewJobCleanupController(store, historyWriter, 30*time.Second)
		ctx := context.Background()

		jobs := []*provisioning.Job{
			{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "job-1",
					Namespace: "ns-1",
					Labels:    map[string]string{LabelJobClaim: "111"},
				},
				Spec: provisioning.JobSpec{Repository: "repo-1", Action: provisioning.JobActionPull},
			},
			{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "job-2",
					Namespace: "ns-2",
					Labels:    map[string]string{LabelJobClaim: "222"},
				},
				Spec: provisioning.JobSpec{Repository: "repo-2", Action: provisioning.JobActionPush},
			},
			{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "job-3",
					Namespace: "ns-3",
					Labels:    map[string]string{LabelJobClaim: "333"},
				},
				Spec: provisioning.JobSpec{Repository: "repo-3", Action: provisioning.JobActionMigrate},
			},
		}

		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).Return(jobs, nil)
		for _, job := range jobs {
			store.On("Complete", mock.Anything, mock.MatchedBy(func(j *provisioning.Job) bool {
				return j.Name == job.Name
			})).Return(nil)
			historyWriter.On("WriteJob", mock.Anything, mock.MatchedBy(func(j *provisioning.Job) bool {
				return j.Name == job.Name
			})).Return(nil)
		}

		err := controller.Cleanup(ctx)

		assert.NoError(t, err)
		store.AssertExpectations(t)
		store.AssertExpectations(t)
		historyWriter.AssertExpectations(t)
		// Verify all 3 jobs were processed
		store.AssertNumberOfCalls(t, "Complete", 3)
		historyWriter.AssertNumberOfCalls(t, "WriteJob", 3)
	})
}

func TestJobCleanupController_Run(t *testing.T) {
	t.Run("runs cleanup on start and periodically", func(t *testing.T) {
		store := &MockStore{}
		
		historyWriter := &MockHistoryWriter{}

		// Use short expiry to get short cleanup interval for testing
		controller := NewJobCleanupController(store, historyWriter, 10*time.Second)
		// Override to even shorter for test
		controller.cleanupInterval = 50 * time.Millisecond

		ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		defer cancel()

		// Expect initial cleanup + periodic cleanups (at least 2, maybe more depending on timing)
		callCount := 0
		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).
			Return([]*provisioning.Job{}, nil).
			Run(func(args mock.Arguments) {
				callCount++
			}).
			Maybe() // Allow variable number of calls due to timing

		err := controller.Run(ctx)

		// Should return context.DeadlineExceeded when context times out
		require.Error(t, err)
		assert.Equal(t, context.DeadlineExceeded, err)
		
		// Verify cleanup was called at least 3 times (initial + 2 periodic)
		assert.GreaterOrEqual(t, callCount, 3, "should have run cleanup at least 3 times")
	})

	t.Run("stops when context is cancelled", func(t *testing.T) {
		store := &MockStore{}
		
		historyWriter := &MockHistoryWriter{}

		controller := NewJobCleanupController(store, historyWriter, 30*time.Second)
		controller.cleanupInterval = 1 * time.Second

		ctx, cancel := context.WithCancel(context.Background())

		// Expect initial cleanup
		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).Return([]*provisioning.Job{}, nil).Once()

		// Cancel after initial cleanup
		go func() {
			time.Sleep(50 * time.Millisecond)
			cancel()
		}()

		err := controller.Run(ctx)

		assert.Error(t, err)
		assert.Equal(t, context.Canceled, err)
		store.AssertExpectations(t)
	})

	t.Run("continues running after cleanup error", func(t *testing.T) {
		store := &MockStore{}
		
		historyWriter := &MockHistoryWriter{}

		controller := NewJobCleanupController(store, historyWriter, 10*time.Second)
		controller.cleanupInterval = 50 * time.Millisecond

		ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
		defer cancel()

		// Track successful calls after initial failure
		successCount := 0
		// First cleanup fails
		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).
			Return(nil, errors.New("first failure")).Once()
		// Subsequent cleanups succeed
		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).
			Run(func(args mock.Arguments) {
				successCount++
			}).
			Return([]*provisioning.Job{}, nil).
			Maybe()

		err := controller.Run(ctx)

		// Should still run and return context error
		require.Error(t, err)
		assert.Equal(t, context.DeadlineExceeded, err)
		// Verify it was called successfully at least once after first failure
		assert.GreaterOrEqual(t, successCount, 1, "should have retried after first failure")
	})

	t.Run("logs error when periodic cleanup fails", func(t *testing.T) {
		store := &MockStore{}
		
		historyWriter := &MockHistoryWriter{}

		controller := NewJobCleanupController(store, historyWriter, 10*time.Second)
		controller.cleanupInterval = 50 * time.Millisecond

		ctx, cancel := context.WithTimeout(context.Background(), 125*time.Millisecond)
		defer cancel()

		// Initial cleanup succeeds
		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).
			Return([]*provisioning.Job{}, nil).Once()
		
		// First periodic cleanup fails (this tests the error logging in ticker case)
		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).
			Return(nil, errors.New("periodic failure")).Once()
		
		// Subsequent cleanups succeed
		store.On("ListExpiredJobs", mock.Anything, mock.Anything, 100).
			Return([]*provisioning.Job{}, nil).
			Maybe()

		err := controller.Run(ctx)

		// Should still run and return context error, not the cleanup error
		require.Error(t, err)
		assert.Equal(t, context.DeadlineExceeded, err)
		store.AssertExpectations(t)
	})
}

