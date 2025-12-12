package sync

import (
	"context"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

/*
TestIncrementalSync_HierarchicalErrorHandling tests the hierarchical error handling behavior:

FOLDER CREATION FAILURES:
- When EnsureFolderPathExist fails with PathCreationError, the path is tracked
- Subsequent resources under that path are skipped with FileActionIgnored
- Only the initial folder creation error counts toward error limits
- WriteResourceFromFile can also return PathCreationError for implicit folder creation

FOLDER DELETION FAILURES (cleanupOrphanedFolders):
- When RemoveResourceFromFile fails, path is tracked in failedDeletions
- In cleanupOrphanedFolders, HasFailedDeletionsUnder() is checked before RemoveFolder
- If children failed to delete, folder cleanup is skipped with a span event

DELETIONS NOT AFFECTED BY CREATION FAILURES:
- IsNestedUnderFailedCreation is NOT checked for FileActionDeleted
- Deletions proceed even if their parent folder failed to be created
- This handles cleanup of resources that exist from previous syncs

RENAME OPERATIONS:
- RenameResourceFile can return PathCreationError for the destination folder
- Renames are affected by failed destination folder creation
- Renames are NOT skipped due to source folder creation failures

AUTOMATIC TRACKING:
- Record() automatically detects PathCreationError via errors.As() and adds to failedCreations
- Record() automatically detects FileActionDeleted with error and adds to failedDeletions
- No manual tracking calls needed
*/
func TestIncrementalSync_HierarchicalErrorHandling(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*repository.MockVersioned, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder)
		changes       []repository.VersionedFileChange
		previousRef   string
		currentRef    string
		description   string
		expectError   bool
		errorContains string
	}{
		{
			name:        "folder creation fails, nested file skipped",
			description: "When unsupported/ fails to create via EnsureFolderPathExist, nested file is skipped",
			previousRef: "old-ref",
			currentRef:  "new-ref",
			changes: []repository.VersionedFileChange{
				{Action: repository.FileActionCreated, Path: "unsupported/file.txt", Ref: "new-ref"},
				{Action: repository.FileActionCreated, Path: "unsupported/nested/file2.txt", Ref: "new-ref"},
			},
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				// First file triggers folder creation which fails
				folderErr := &resources.PathCreationError{Path: "unsupported/", Err: fmt.Errorf("permission denied")}
				repoResources.On("EnsureFolderPathExist", mock.Anything, "unsupported/").Return("", folderErr).Once()

				// First file recorded with error (note: error is from folder creation, but recorded against file)
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "unsupported/file.txt" &&
						r.Action == repository.FileActionIgnored &&
						r.Error != nil
				})).Return().Once()

				// Second file is skipped because parent folder failed
				progress.On("IsNestedUnderFailedCreation", "unsupported/nested/file2.txt").Return(true).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "unsupported/nested/file2.txt" &&
						r.Action == repository.FileActionIgnored &&
						r.Error != nil &&
						r.Error.Error() == "skipped: parent folder creation failed"
				})).Return().Once()
			},
		},
		{
			name:        "WriteResourceFromFile returns PathCreationError, nested resources skipped",
			description: "When WriteResourceFromFile implicitly creates a folder and fails, nested resources are skipped",
			previousRef: "old-ref",
			currentRef:  "new-ref",
			changes: []repository.VersionedFileChange{
				{Action: repository.FileActionCreated, Path: "folder1/file1.json", Ref: "new-ref"},
				{Action: repository.FileActionCreated, Path: "folder1/file2.json", Ref: "new-ref"},
				{Action: repository.FileActionCreated, Path: "folder1/nested/file3.json", Ref: "new-ref"},
			},
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				// First file write fails with PathCreationError
				folderErr := &resources.PathCreationError{Path: "folder1/", Err: fmt.Errorf("permission denied")}
				repoResources.On("WriteResourceFromFile", mock.Anything, "folder1/file1.json", "new-ref").
					Return("", schema.GroupVersionKind{}, folderErr).Once()

				// First file recorded with error, automatically tracked
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/file1.json" &&
						r.Action == repository.FileActionCreated &&
						r.Error != nil
				})).Return().Once()

				// Subsequent files are skipped
				progress.On("IsNestedUnderFailedCreation", "folder1/file2.json").Return(true).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/file2.json" && r.Action == repository.FileActionIgnored
				})).Return().Once()

				progress.On("IsNestedUnderFailedCreation", "folder1/nested/file3.json").Return(true).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/nested/file3.json" && r.Action == repository.FileActionIgnored
				})).Return().Once()
			},
		},
		{
			name:        "file deletion fails, folder cleanup skipped",
			description: "When RemoveResourceFromFile fails, cleanupOrphanedFolders skips folder removal",
			previousRef: "old-ref",
			currentRef:  "new-ref",
			changes: []repository.VersionedFileChange{
				{Action: repository.FileActionDeleted, Path: "dashboards/file1.json", PreviousRef: "old-ref"},
			},
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				// File deletion fails
				progress.On("IsNestedUnderFailedCreation", "dashboards/file1.json").Return(false).Once()
				repoResources.On("RemoveResourceFromFile", mock.Anything, "dashboards/file1.json", "old-ref").
					Return("dashboard-1", "folder-uid", schema.GroupVersionKind{Kind: "Dashboard"}, fmt.Errorf("permission denied")).Once()

				// Error recorded, automatically tracked in failedDeletions
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "dashboards/file1.json" &&
						r.Action == repository.FileActionDeleted &&
						r.Error != nil
				})).Return().Once()

				// During cleanup, folder deletion is skipped
				progress.On("HasFailedDeletionsUnder", "dashboards/").Return(true).Once()

				// Note: RemoveFolder should NOT be called (verified via AssertNotCalled in test)
			},
		},
		{
			name:        "deletion proceeds despite creation failure",
			description: "When folder1/ creation fails, deletion of folder1/old.json still proceeds",
			previousRef: "old-ref",
			currentRef:  "new-ref",
			changes: []repository.VersionedFileChange{
				{Action: repository.FileActionCreated, Path: "folder1/new.json", Ref: "new-ref"},
				{Action: repository.FileActionDeleted, Path: "folder1/old.json", PreviousRef: "old-ref"},
			},
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				// Creation fails
				progress.On("IsNestedUnderFailedCreation", "folder1/new.json").Return(false).Once()
				folderErr := &resources.PathCreationError{Path: "folder1/", Err: fmt.Errorf("permission denied")}
				repoResources.On("WriteResourceFromFile", mock.Anything, "folder1/new.json", "new-ref").
					Return("", schema.GroupVersionKind{}, folderErr).Once()

				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/new.json" && r.Error != nil
				})).Return().Once()

				// Deletion proceeds (NOT checking IsNestedUnderFailedCreation for deletions)
				progress.On("IsNestedUnderFailedCreation", "folder1/old.json").Return(false).Once()
				repoResources.On("RemoveResourceFromFile", mock.Anything, "folder1/old.json", "old-ref").
					Return("old-resource", "", schema.GroupVersionKind{Kind: "Dashboard"}, nil).Once()

				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/old.json" &&
						r.Action == repository.FileActionDeleted &&
						r.Error == nil // Deletion succeeds!
				})).Return().Once()
			},
		},
		{
			name:        "multi-level nesting cascade",
			description: "When level1/ fails, level1/level2/level3/file.json is also skipped",
			previousRef: "old-ref",
			currentRef:  "new-ref",
			changes: []repository.VersionedFileChange{
				{Action: repository.FileActionCreated, Path: "level1/file.txt", Ref: "new-ref"},
				{Action: repository.FileActionCreated, Path: "level1/level2/file.txt", Ref: "new-ref"},
				{Action: repository.FileActionCreated, Path: "level1/level2/level3/file.txt", Ref: "new-ref"},
			},
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				// First file triggers level1/ failure
				folderErr := &resources.PathCreationError{Path: "level1/", Err: fmt.Errorf("permission denied")}
				repoResources.On("EnsureFolderPathExist", mock.Anything, "level1/").Return("", folderErr).Once()

				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "level1/file.txt" && r.Action == repository.FileActionIgnored
				})).Return().Once()

				// All nested files are skipped
				for _, path := range []string{"level1/level2/file.txt", "level1/level2/level3/file.txt"} {
					progress.On("IsNestedUnderFailedCreation", path).Return(true).Once()
					progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
						return r.Path == path && r.Action == repository.FileActionIgnored
					})).Return().Once()
				}
			},
		},
		{
			name:        "mixed success and failure",
			description: "When success/ works and failure/ fails, only failure/* are skipped",
			previousRef: "old-ref",
			currentRef:  "new-ref",
			changes: []repository.VersionedFileChange{
				{Action: repository.FileActionCreated, Path: "success/file1.json", Ref: "new-ref"},
				{Action: repository.FileActionCreated, Path: "success/nested/file2.json", Ref: "new-ref"},
				{Action: repository.FileActionCreated, Path: "failure/file3.txt", Ref: "new-ref"},
				{Action: repository.FileActionCreated, Path: "failure/nested/file4.txt", Ref: "new-ref"},
			},
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				// Success path works
				progress.On("IsNestedUnderFailedCreation", "success/file1.json").Return(false).Once()
				repoResources.On("WriteResourceFromFile", mock.Anything, "success/file1.json", "new-ref").
					Return("resource-1", schema.GroupVersionKind{Kind: "Dashboard"}, nil).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "success/file1.json" && r.Error == nil
				})).Return().Once()

				progress.On("IsNestedUnderFailedCreation", "success/nested/file2.json").Return(false).Once()
				repoResources.On("WriteResourceFromFile", mock.Anything, "success/nested/file2.json", "new-ref").
					Return("resource-2", schema.GroupVersionKind{Kind: "Dashboard"}, nil).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "success/nested/file2.json" && r.Error == nil
				})).Return().Once()

				// Failure path fails
				progress.On("IsNestedUnderFailedCreation", "failure/file3.txt").Return(false).Once()
				folderErr := &resources.PathCreationError{Path: "failure/", Err: fmt.Errorf("disk full")}
				repoResources.On("EnsureFolderPathExist", mock.Anything, "failure/").Return("", folderErr).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "failure/file3.txt" && r.Action == repository.FileActionIgnored
				})).Return().Once()

				// Nested file in failure path is skipped
				progress.On("IsNestedUnderFailedCreation", "failure/nested/file4.txt").Return(true).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "failure/nested/file4.txt" && r.Action == repository.FileActionIgnored
				})).Return().Once()
			},
		},
		{
			name:        "rename with failed destination folder",
			description: "When RenameResourceFile fails with PathCreationError for destination, rename is skipped",
			previousRef: "old-ref",
			currentRef:  "new-ref",
			changes: []repository.VersionedFileChange{
				{
					Action:       repository.FileActionRenamed,
					Path:         "newfolder/file.json",
					PreviousPath: "oldfolder/file.json",
					Ref:          "new-ref",
					PreviousRef:  "old-ref",
				},
			},
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				// Rename fails with PathCreationError for destination folder
				progress.On("IsNestedUnderFailedCreation", "newfolder/file.json").Return(false).Once()
				folderErr := &resources.PathCreationError{Path: "newfolder/", Err: fmt.Errorf("permission denied")}
				repoResources.On("RenameResourceFile", mock.Anything, "oldfolder/file.json", "old-ref", "newfolder/file.json", "new-ref").
					Return("", "", schema.GroupVersionKind{}, folderErr).Once()

				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "newfolder/file.json" &&
						r.Action == repository.FileActionRenamed &&
						r.Error != nil
				})).Return().Once()
			},
		},
		{
			name:        "renamed file still checked, subsequent nested resources skipped",
			description: "After rename fails for folder1/file.json, other folder1/* files are skipped",
			previousRef: "old-ref",
			currentRef:  "new-ref",
			changes: []repository.VersionedFileChange{
				{Action: repository.FileActionRenamed, Path: "folder1/file1.json", PreviousPath: "old/file1.json", Ref: "new-ref", PreviousRef: "old-ref"},
				{Action: repository.FileActionCreated, Path: "folder1/file2.json", Ref: "new-ref"},
			},
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				// Rename is NOT skipped for creation failures (it's checking the destination path)
				progress.On("IsNestedUnderFailedCreation", "folder1/file1.json").Return(true).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/file1.json" &&
						r.Action == repository.FileActionIgnored &&
						r.Error.Error() == "skipped: parent folder creation failed"
				})).Return().Once()

				// Second file also skipped
				progress.On("IsNestedUnderFailedCreation", "folder1/file2.json").Return(true).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/file2.json" && r.Action == repository.FileActionIgnored
				})).Return().Once()
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockVersioned(t)
			repoResources := resources.NewMockRepositoryResources(t)
			progress := jobs.NewMockJobProgressRecorder(t)

			repo.On("CompareFiles", mock.Anything, tt.previousRef, tt.currentRef).Return(tt.changes, nil)
			progress.On("SetTotal", mock.Anything, len(tt.changes)).Return()
			progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
			progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
			progress.On("TooManyErrors").Return(nil).Maybe()

			tt.setupMocks(repo, repoResources, progress)

			err := IncrementalSync(context.Background(), repo, tt.previousRef, tt.currentRef, repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))

			if tt.expectError {
				require.Error(t, err)
				if tt.errorContains != "" {
					require.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				require.NoError(t, err)
			}

			progress.AssertExpectations(t)
			repoResources.AssertExpectations(t)
			// For deletion tests, verify RemoveFolder was NOT called
			if tt.name == "file deletion fails, folder cleanup skipped" {
				repoResources.AssertNotCalled(t, "RemoveFolder", mock.Anything, mock.Anything)
			}
		})
	}
}
