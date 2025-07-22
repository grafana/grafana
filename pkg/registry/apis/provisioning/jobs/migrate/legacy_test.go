package migrate

import (
	"context"
	"errors"
	"testing"
	"time"

	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

func TestWrapWithStageFn(t *testing.T) {
	t.Run("should return error when repository is not a ReaderWriter", func(t *testing.T) {
		// Setup
		ctx := context.Background()
		// Create the wrapper function that matches WrapWithCloneFn signature
		wrapFn := func(ctx context.Context, rw repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
			// pass a reader to function call
			repo := repository.NewMockReader(t)
			return fn(repo, true)
		}

		legacyFoldersMigrator := NewLegacyMigrator(
			NewMockLegacyResourcesMigrator(t),
			NewMockStorageSwapper(t),
			jobs.NewMockWorker(t),
			wrapFn,
		)

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("StrictMaxErrors", 1).Return()
		progress.On("SetMessage", mock.Anything, "migrating legacy resources").Return()

		// Execute
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "test-namespace",
			},
		})
		err := legacyFoldersMigrator.Migrate(ctx, repo, provisioning.MigrateJobOptions{}, progress)
		// Assert
		require.Error(t, err)
		require.Contains(t, err.Error(), "migration job submitted targeting repository that is not a ReaderWriter")
	})
}
func TestWrapWithCloneFn_Error(t *testing.T) {
	t.Run("should return error when wrapFn fails", func(t *testing.T) {
		// Setup
		ctx := context.Background()
		expectedErr := errors.New("clone failed")

		// Create the wrapper function that returns an error
		wrapFn := func(ctx context.Context, rw repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
			return expectedErr
		}

		legacyMigrator := NewLegacyMigrator(
			NewMockLegacyResourcesMigrator(t),
			NewMockStorageSwapper(t),
			jobs.NewMockWorker(t),
			wrapFn,
		)

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("StrictMaxErrors", 1).Return()
		progress.On("SetMessage", mock.Anything, "migrating legacy resources").Return()
		// Execute
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "test-namespace",
			},
		})

		err := legacyMigrator.Migrate(ctx, repo, provisioning.MigrateJobOptions{}, progress)

		// Assert
		require.Error(t, err)
		require.Contains(t, err.Error(), "migrate from SQL: clone failed")
	})
}

func TestLegacyMigrator_MigrateFails(t *testing.T) {
	t.Run("should return error when legacyMigrator.Migrate fails", func(t *testing.T) {
		// Setup
		ctx := context.Background()
		expectedErr := errors.New("migration failed")

		mockLegacyMigrator := NewMockLegacyResourcesMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.Anything, "test-namespace", mock.Anything, mock.Anything).
			Return(expectedErr)

		mockStorageSwapper := NewMockStorageSwapper(t)
		mockWorker := jobs.NewMockWorker(t)

		// Create a wrapper function that calls the provided function
		wrapFn := func(ctx context.Context, rw repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
			return fn(rw, true)
		}

		legacyMigrator := NewLegacyMigrator(
			mockLegacyMigrator,
			mockStorageSwapper,
			mockWorker,
			wrapFn,
		)

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("StrictMaxErrors", 1).Return()
		progress.On("SetMessage", mock.Anything, "migrating legacy resources").Return()

		// Execute
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "test-namespace",
			},
		})

		err := legacyMigrator.Migrate(ctx, repo, provisioning.MigrateJobOptions{}, progress)

		// Assert
		require.Error(t, err)
		require.Contains(t, err.Error(), "migrate from SQL: migration failed")

		// Storage swapper should not be called when migration fails
		mockStorageSwapper.AssertNotCalled(t, "WipeUnifiedAndSetMigratedFlag")
	})
}

func TestLegacyMigrator_ResetUnifiedStorageFails(t *testing.T) {
	t.Run("should return error when storage reset fails", func(t *testing.T) {
		// Setup
		ctx := context.Background()
		expectedErr := errors.New("reset failed")

		mockLegacyMigrator := NewMockLegacyResourcesMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.Anything, "test-namespace", mock.Anything, mock.Anything).
			Return(nil)

		mockStorageSwapper := NewMockStorageSwapper(t)
		mockStorageSwapper.On("WipeUnifiedAndSetMigratedFlag", mock.Anything, "test-namespace").
			Return(expectedErr)

		mockWorker := jobs.NewMockWorker(t)

		// Create a wrapper function that calls the provided function
		wrapFn := func(ctx context.Context, rw repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
			return fn(rw, true)
		}

		legacyMigrator := NewLegacyMigrator(
			mockLegacyMigrator,
			mockStorageSwapper,
			mockWorker,
			wrapFn,
		)

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("StrictMaxErrors", 1).Return()
		progress.On("SetMessage", mock.Anything, "migrating legacy resources").Return()
		progress.On("SetMessage", mock.Anything, "resetting unified storage").Return()

		// Execute
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "test-namespace",
			},
		})

		err := legacyMigrator.Migrate(ctx, repo, provisioning.MigrateJobOptions{}, progress)

		// Assert
		require.Error(t, err)
		require.Contains(t, err.Error(), "unable to reset unified storage")

		// Sync worker should not be called when reset fails
		mockWorker.AssertNotCalled(t, "Process")
	})
}

func TestLegacyMigrator_SyncFails(t *testing.T) {
	t.Run("should revert storage settings when sync fails", func(t *testing.T) {
		// Setup
		ctx := context.Background()
		expectedErr := errors.New("sync failed")

		mockLegacyMigrator := NewMockLegacyResourcesMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.Anything, "test-namespace", mock.Anything, mock.Anything).
			Return(nil)

		mockStorageSwapper := NewMockStorageSwapper(t)
		mockStorageSwapper.On("WipeUnifiedAndSetMigratedFlag", mock.Anything, "test-namespace").
			Return(nil)
		mockStorageSwapper.On("StopReadingUnifiedStorage", mock.Anything).
			Return(nil)

		mockWorker := jobs.NewMockWorker(t)
		mockWorker.On("Process", mock.Anything, mock.Anything, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
		}), mock.Anything).Return(expectedErr)

		// Create a wrapper function that calls the provided function
		wrapFn := func(ctx context.Context, rw repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
			return fn(rw, true)
		}

		legacyMigrator := NewLegacyMigrator(
			mockLegacyMigrator,
			mockStorageSwapper,
			mockWorker,
			wrapFn,
		)

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("StrictMaxErrors", 1).Return()
		progress.On("SetMessage", mock.Anything, "migrating legacy resources").Return()
		progress.On("SetMessage", mock.Anything, "resetting unified storage").Return()
		progress.On("ResetResults").Return()
		progress.On("SetMessage", mock.Anything, "pulling resources").Return()
		progress.On("SetMessage", mock.Anything, "error importing resources, reverting").Return()

		// Execute
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "test-namespace",
			},
		})

		err := legacyMigrator.Migrate(ctx, repo, provisioning.MigrateJobOptions{}, progress)

		// Assert
		require.Error(t, err)
		require.Contains(t, err.Error(), "sync failed")

		// Verify storage settings were reverted
		mockStorageSwapper.AssertCalled(t, "StopReadingUnifiedStorage", mock.Anything)
	})

	t.Run("should handle revert failure after sync failure", func(t *testing.T) {
		// Setup
		ctx := context.Background()
		syncErr := errors.New("sync failed")
		revertErr := errors.New("revert failed")

		mockLegacyMigrator := NewMockLegacyResourcesMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.Anything, "test-namespace", mock.Anything, mock.Anything).
			Return(nil)

		mockStorageSwapper := NewMockStorageSwapper(t)
		mockStorageSwapper.On("WipeUnifiedAndSetMigratedFlag", mock.Anything, "test-namespace").
			Return(nil)
		mockStorageSwapper.On("StopReadingUnifiedStorage", mock.Anything).
			Return(revertErr)

		mockWorker := jobs.NewMockWorker(t)
		mockWorker.On("Process", mock.Anything, mock.Anything, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
		}), mock.Anything).Return(syncErr)

		// Create a wrapper function that calls the provided function
		wrapFn := func(ctx context.Context, rw repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
			return fn(rw, true)
		}

		legacyMigrator := NewLegacyMigrator(
			mockLegacyMigrator,
			mockStorageSwapper,
			mockWorker,
			wrapFn,
		)

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("StrictMaxErrors", 1).Return()
		progress.On("SetMessage", mock.Anything, "migrating legacy resources").Return()
		progress.On("SetMessage", mock.Anything, "resetting unified storage").Return()
		progress.On("ResetResults").Return()
		progress.On("SetMessage", mock.Anything, "pulling resources").Return()
		progress.On("SetMessage", mock.Anything, "error importing resources, reverting").Return()

		// Execute
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "test-namespace",
			},
		})

		err := legacyMigrator.Migrate(ctx, repo, provisioning.MigrateJobOptions{}, progress)

		// Assert
		require.Error(t, err)
		require.Contains(t, err.Error(), "sync failed")

		// Verify both errors occurred
		mockStorageSwapper.AssertCalled(t, "StopReadingUnifiedStorage", mock.Anything)
	})
}

func TestLegacyMigrator_Success(t *testing.T) {
	t.Run("should complete migration successfully", func(t *testing.T) {
		// Setup
		ctx := context.Background()

		mockLegacyMigrator := NewMockLegacyResourcesMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.Anything, "test-namespace", mock.Anything, mock.Anything).
			Return(nil)

		mockStorageSwapper := NewMockStorageSwapper(t)
		mockStorageSwapper.On("WipeUnifiedAndSetMigratedFlag", mock.Anything, "test-namespace").
			Return(nil)

		mockWorker := jobs.NewMockWorker(t)
		mockWorker.On("Process", mock.Anything, mock.Anything, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
		}), mock.Anything).Return(nil)

		// Create a wrapper function that calls the provided function
		wrapFn := func(ctx context.Context, rw repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
			return fn(rw, true)
		}

		legacyMigrator := NewLegacyMigrator(
			mockLegacyMigrator,
			mockStorageSwapper,
			mockWorker,
			wrapFn,
		)

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("StrictMaxErrors", 1).Return()
		progress.On("SetMessage", mock.Anything, "migrating legacy resources").Return()
		progress.On("SetMessage", mock.Anything, "resetting unified storage").Return()
		progress.On("ResetResults").Return()
		progress.On("SetMessage", mock.Anything, "pulling resources").Return()

		// Execute
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "test-namespace",
			},
		})

		err := legacyMigrator.Migrate(ctx, repo, provisioning.MigrateJobOptions{}, progress)

		// Assert
		require.NoError(t, err)

		// Verify all expected operations were called in order
		mockLegacyMigrator.AssertCalled(t, "Migrate", mock.Anything, mock.Anything, "test-namespace", mock.Anything, mock.Anything)
		mockStorageSwapper.AssertCalled(t, "WipeUnifiedAndSetMigratedFlag", mock.Anything, "test-namespace")
		mockWorker.AssertCalled(t, "Process", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})
}

func TestLegacyMigrator_BeforeFnExecution(t *testing.T) {
	t.Run("should execute beforeFn functions", func(t *testing.T) {
		// Setup
		mockLegacyMigrator := NewMockLegacyResourcesMigrator(t)
		mockStorageSwapper := NewMockStorageSwapper(t)
		mockWorker := jobs.NewMockWorker(t)
		// Create a wrapper function that calls the provided function
		wrapFn := func(ctx context.Context, rw repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
			return errors.New("abort test here")
		}

		legacyMigrator := NewLegacyMigrator(
			mockLegacyMigrator,
			mockStorageSwapper,
			mockWorker,
			wrapFn,
		)

		progress := jobs.NewMockJobProgressRecorder(t)
		// No progress messages expected in current staging implementation
		progress.On("StrictMaxErrors", 1).Return()
		progress.On("SetMessage", mock.Anything, "migrating legacy resources").Return()

		// Execute
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "test-namespace",
			},
		})

		err := legacyMigrator.Migrate(context.Background(), repo, provisioning.MigrateJobOptions{}, progress)
		require.EqualError(t, err, "migrate from SQL: abort test here")
	})
}

func TestLegacyMigrator_ProgressScanner(t *testing.T) {
	t.Run("should update progress with scanner", func(t *testing.T) {
		mockLegacyMigrator := NewMockLegacyResourcesMigrator(t)
		mockStorageSwapper := NewMockStorageSwapper(t)
		mockWorker := jobs.NewMockWorker(t)

		// Create a wrapper function that calls the provided function
		wrapFn := func(ctx context.Context, rw repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
			return errors.New("abort test here")
		}

		legacyMigrator := NewLegacyMigrator(
			mockLegacyMigrator,
			mockStorageSwapper,
			mockWorker,
			wrapFn,
		)

		progress := jobs.NewMockJobProgressRecorder(t)
		// No progress messages expected in current staging implementation
		progress.On("StrictMaxErrors", 1).Return()
		progress.On("SetMessage", mock.Anything, "migrating legacy resources").Return()

		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "test-namespace",
			},
		})

		err := legacyMigrator.Migrate(context.Background(), repo, provisioning.MigrateJobOptions{}, progress)
		require.EqualError(t, err, "migrate from SQL: abort test here")

		require.Eventually(t, func() bool {
			// No progress message calls expected in current staging implementation
			return progress.AssertExpectations(t)
		}, time.Second, 10*time.Millisecond)
	})
}
