package jobs

import (
	"context"
	"testing"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJobProgressRecorderSetRefURLs(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Test setting RefURLs
	expectedRefURLs := &provisioning.RepositoryURLs{
		SourceURL:         "https://github.com/grafana/grafana/tree/feature-branch",
		CompareURL:        "https://github.com/grafana/grafana/compare/main...feature-branch",
		NewPullRequestURL: "https://github.com/grafana/grafana/compare/main...feature-branch?quick_pull=1&labels=grafana",
	}

	recorder.SetRefURLs(ctx, expectedRefURLs)

	// Verify RefURLs are stored
	recorder.mu.RLock()
	assert.Equal(t, expectedRefURLs, recorder.refURLs)
	recorder.mu.RUnlock()

	// Test that RefURLs are included in the final status
	finalStatus := recorder.Complete(ctx, nil)
	assert.Equal(t, expectedRefURLs, finalStatus.URLs)
}

func TestJobProgressRecorderSetRefURLsNil(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Test setting nil RefURLs
	recorder.SetRefURLs(ctx, nil)

	// Verify nil RefURLs are stored
	recorder.mu.RLock()
	assert.Nil(t, recorder.refURLs)
	recorder.mu.RUnlock()

	// Test that nil RefURLs are included in the final status
	finalStatus := recorder.Complete(ctx, nil)
	assert.Nil(t, finalStatus.URLs)
}

func TestJobProgressRecorderCompleteIncludesRefURLs(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Set some RefURLs
	refURLs := &provisioning.RepositoryURLs{
		SourceURL: "https://github.com/grafana/grafana/tree/test-branch",
	}
	recorder.SetRefURLs(ctx, refURLs)

	// Complete the job
	finalStatus := recorder.Complete(ctx, nil)

	// Verify the final status includes RefURLs
	require.NotNil(t, finalStatus.URLs)
	assert.Equal(t, refURLs.SourceURL, finalStatus.URLs.SourceURL)
	assert.Equal(t, provisioning.JobStateSuccess, finalStatus.State)
	assert.Equal(t, "completed successfully", finalStatus.Message)
}

func TestJobProgressRecorderAutomaticFailureTracking(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Record a folder creation failure with PathCreationError
	pathErr := &resources.PathCreationError{
		Path: "folder1/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, JobResourceResult{
		Path:   "folder1/file.json",
		Action: repository.FileActionCreated,
		Error:  pathErr,
	})

	// Record another PathCreationError for a different folder
	pathErr2 := &resources.PathCreationError{
		Path: "folder2/subfolder/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, JobResourceResult{
		Path:   "folder2/subfolder/file.json",
		Action: repository.FileActionCreated,
		Error:  pathErr2,
	})

	// Record a deletion failure
	recorder.Record(ctx, JobResourceResult{
		Path:   "folder3/file1.json",
		Action: repository.FileActionDeleted,
		Error:  assert.AnError,
	})

	// Record another deletion failure
	recorder.Record(ctx, JobResourceResult{
		Path:   "folder4/subfolder/file2.json",
		Action: repository.FileActionDeleted,
		Error:  assert.AnError,
	})

	// Verify failed creations are tracked
	recorder.mu.RLock()
	assert.Len(t, recorder.failedCreations, 2)
	assert.Contains(t, recorder.failedCreations, "folder1/")
	assert.Contains(t, recorder.failedCreations, "folder2/subfolder/")

	// Verify failed deletions are tracked
	assert.Len(t, recorder.failedDeletions, 2)
	assert.Contains(t, recorder.failedDeletions, "folder3/file1.json")
	assert.Contains(t, recorder.failedDeletions, "folder4/subfolder/file2.json")
	recorder.mu.RUnlock()
}

func TestJobProgressRecorderIsNestedUnderFailedCreation(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Add failed creations via Record
	pathErr1 := &resources.PathCreationError{
		Path: "folder1/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, JobResourceResult{
		Path:   "folder1/file.json",
		Action: repository.FileActionCreated,
		Error:  pathErr1,
	})

	pathErr2 := &resources.PathCreationError{
		Path: "folder2/subfolder/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, JobResourceResult{
		Path:   "folder2/subfolder/file.json",
		Action: repository.FileActionCreated,
		Error:  pathErr2,
	})

	// Test nested paths
	assert.True(t, recorder.IsNestedUnderFailedCreation("folder1/file.json"))
	assert.True(t, recorder.IsNestedUnderFailedCreation("folder1/nested/file.json"))
	assert.True(t, recorder.IsNestedUnderFailedCreation("folder2/subfolder/file.json"))

	// Test non-nested paths
	assert.False(t, recorder.IsNestedUnderFailedCreation("other/file.json"))
	assert.False(t, recorder.IsNestedUnderFailedCreation("folder3/file.json"))
	assert.False(t, recorder.IsNestedUnderFailedCreation("file.json"))
}

func TestJobProgressRecorderHasFailedDeletionsUnder(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Add failed deletions via Record
	recorder.Record(ctx, JobResourceResult{
		Path:   "folder1/file1.json",
		Action: repository.FileActionDeleted,
		Error:  assert.AnError,
	})

	recorder.Record(ctx, JobResourceResult{
		Path:   "folder2/subfolder/file2.json",
		Action: repository.FileActionDeleted,
		Error:  assert.AnError,
	})

	recorder.Record(ctx, JobResourceResult{
		Path:   "folder3/nested/deep/file3.json",
		Action: repository.FileActionDeleted,
		Error:  assert.AnError,
	})

	// Test folder paths with failed deletions
	assert.True(t, recorder.HasFailedDeletionsUnder("folder1/"))
	assert.True(t, recorder.HasFailedDeletionsUnder("folder2/"))
	assert.True(t, recorder.HasFailedDeletionsUnder("folder2/subfolder/"))
	assert.True(t, recorder.HasFailedDeletionsUnder("folder3/"))
	assert.True(t, recorder.HasFailedDeletionsUnder("folder3/nested/"))
	assert.True(t, recorder.HasFailedDeletionsUnder("folder3/nested/deep/"))

	// Test folder paths without failed deletions
	assert.False(t, recorder.HasFailedDeletionsUnder("other/"))
	assert.False(t, recorder.HasFailedDeletionsUnder("different/"))
}

func TestJobProgressRecorderResetResults(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Add some data via Record
	pathErr := &resources.PathCreationError{
		Path: "folder1/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, JobResourceResult{
		Path:   "folder1/file.json",
		Action: repository.FileActionCreated,
		Error:  pathErr,
	})

	recorder.Record(ctx, JobResourceResult{
		Path:   "folder2/file.json",
		Action: repository.FileActionDeleted,
		Error:  assert.AnError,
	})

	// Verify data is stored
	recorder.mu.RLock()
	assert.Len(t, recorder.failedCreations, 1)
	assert.Len(t, recorder.failedDeletions, 1)
	recorder.mu.RUnlock()

	// Reset results
	recorder.ResetResults()

	// Verify data is cleared
	recorder.mu.RLock()
	assert.Nil(t, recorder.failedCreations)
	assert.Nil(t, recorder.failedDeletions)
	recorder.mu.RUnlock()
}

func TestJobProgressRecorderConcurrentAccess(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn)

	// Test concurrent writes and reads
	done := make(chan bool)

	// Writer goroutines
	for i := 0; i < 10; i++ {
		go func(idx int) {
			pathErr := &resources.PathCreationError{
				Path: "folder/",
				Err:  assert.AnError,
			}
			recorder.Record(ctx, JobResourceResult{
				Path:   "test/path",
				Action: repository.FileActionCreated,
				Error:  pathErr,
			})
			recorder.Record(ctx, JobResourceResult{
				Path:   "test/file.json",
				Action: repository.FileActionDeleted,
				Error:  assert.AnError,
			})
			done <- true
		}(i)
	}

	// Reader goroutines
	for i := 0; i < 10; i++ {
		go func() {
			recorder.IsNestedUnderFailedCreation("test/path")
			recorder.HasFailedDeletionsUnder("test/")
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 20; i++ {
		<-done
	}

	// Just verify no panics occurred and basic functionality works
	assert.NotNil(t, recorder)
}

func TestJobProgressRecorderIgnoredActionsDontCountAsErrors(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Record an ignored action with error
	recorder.Record(ctx, JobResourceResult{
		Path:   "folder1/file1.json",
		Action: repository.FileActionIgnored,
		Error:  assert.AnError,
	})

	// Record a real error for comparison
	recorder.Record(ctx, JobResourceResult{
		Path:   "folder2/file2.json",
		Action: repository.FileActionCreated,
		Error:  assert.AnError,
	})

	// Verify error count doesn't include ignored actions
	recorder.mu.RLock()
	assert.Equal(t, 1, recorder.errorCount, "ignored actions should not be counted as errors")
	assert.Len(t, recorder.errors, 1, "ignored action errors should not be in error list")
	recorder.mu.RUnlock()
}
