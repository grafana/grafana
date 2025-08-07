package sync

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestIncrementalSync_ContextCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	repo := repository.NewMockVersioned(t)
	repoResources := resources.NewMockRepositoryResources(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return([]repository.VersionedFileChange{
		{
			Action: repository.FileActionCreated,
			Path:   "dashboards/test.json",
			Ref:    "new-ref",
		},
	}, nil)
	progress.On("SetTotal", mock.Anything, 1).Return()
	progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()

	err := IncrementalSync(ctx, repo, "old-ref", "new-ref", repoResources, progress)
	require.EqualError(t, err, "context canceled")
}

func TestIncrementalSync(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*repository.MockVersioned, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder)
		previousRef   string
		currentRef    string
		expectedError string
		expectedCalls int
		expectedFiles []repository.VersionedFileChange
	}{
		{
			name: "same commit as last time",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				progress.On("SetFinalMessage", mock.Anything, "same commit as last time").Return()
			},
			previousRef: "old-ref",
			currentRef:  "old-ref",
		},
		{
			name: "no changes between commits",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return([]repository.VersionedFileChange{}, nil)
				progress.On("SetFinalMessage", mock.Anything, "no changes detected between commits").Return()
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name: "error comparing files",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(nil, fmt.Errorf("compare error"))
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedError: "compare files error: compare error",
		},
		{
			name: "successful sync with file changes",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/test.json",
						Ref:    "new-ref",
					},
					{
						Action: repository.FileActionUpdated,
						Path:   "alerts/alert.yaml",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 2).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				// Mock successful resource writes
				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "new-ref").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)
				repoResources.On("WriteResourceFromFile", mock.Anything, "alerts/alert.yaml", "new-ref").
					Return("test-alert", schema.GroupVersionKind{Kind: "Alert", Group: "alerts"}, nil)

				// Mock progress recording
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action == repository.FileActionCreated && result.Path == "dashboards/test.json"
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action == repository.FileActionUpdated && result.Path == "alerts/alert.yaml"
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedCalls: 2,
		},
		{
			name: "unsupported file path with valid folder",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "unsupported/path/file.txt",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				// Mock folder creation
				repoResources.On("EnsureFolderPathExist", mock.Anything, "unsupported/path/").
					Return("test-folder", nil)

				// Mock progress recording
				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action:   repository.FileActionCreated,
					Path:     "unsupported/path/",
					Resource: resources.FolderResource.Resource,
					Group:    resources.FolderResource.Group,
					Name:     "test-folder",
				}).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedCalls: 1,
		},
		{
			name: "unsupported file path with invalid folder",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   ".unsupported/path/file.txt",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action: repository.FileActionIgnored,
					Path:   ".unsupported/path/file.txt",
				}).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedCalls: 1,
		},
		{
			name: "file deletion",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action:      repository.FileActionDeleted,
						Path:        "dashboards/old.json",
						PreviousRef: "old-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				// Mock resource deletion
				repoResources.On("RemoveResourceFromFile", mock.Anything, "dashboards/old.json", "old-ref").
					Return("old-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				// Mock progress recording
				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action:   repository.FileActionDeleted,
					Path:     "dashboards/old.json",
					Name:     "old-dashboard",
					Resource: "Dashboard",
					Group:    "dashboards",
				}).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedCalls: 1,
		},
		{
			name: "file rename",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action:       repository.FileActionRenamed,
						Path:         "dashboards/new.json",
						PreviousPath: "dashboards/old.json",
						Ref:          "new-ref",
						PreviousRef:  "old-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				// Mock resource rename
				repoResources.On("RenameResourceFile", mock.Anything, "dashboards/old.json", "old-ref", "dashboards/new.json", "new-ref").
					Return("renamed-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				// Mock progress recording
				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action:   repository.FileActionRenamed,
					Path:     "dashboards/new.json",
					Name:     "renamed-dashboard",
					Resource: "Dashboard",
					Group:    "dashboards",
				}).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedCalls: 1,
		},
		{
			name: "file ignored",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionIgnored,
						Path:   "dashboards/ignored.json",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action: repository.FileActionIgnored,
					Path:   "dashboards/ignored.json",
				}).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedCalls: 1,
		},
		{
			name: "error creating folder",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "unsupported/path/file.txt",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()

				// Mock folder creation error
				repoResources.On("EnsureFolderPathExist", mock.Anything, "unsupported/path/").
					Return("", fmt.Errorf("failed to create folder"))

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedError: "unable to create empty file folder: failed to create folder",
		},
		{
			name: "error writing resource",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/test.json",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				// Mock resource write error
				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "new-ref").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, fmt.Errorf("write failed"))

				// Mock progress recording with error
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action == repository.FileActionCreated &&
						result.Path == "dashboards/test.json" &&
						result.Name == "test-dashboard" &&
						result.Resource == "Dashboard" &&
						result.Group == "dashboards" &&
						result.Error != nil &&
						result.Error.Error() == "writing resource from file dashboards/test.json: write failed"
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedCalls: 1,
		},
		{
			name: "error deleting resource",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action:      repository.FileActionDeleted,
						Path:        "dashboards/old.json",
						PreviousRef: "old-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				// Mock resource deletion error
				repoResources.On("RemoveResourceFromFile", mock.Anything, "dashboards/old.json", "old-ref").
					Return("old-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, fmt.Errorf("delete failed"))

				// Mock progress recording with error
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action == repository.FileActionDeleted &&
						result.Path == "dashboards/old.json" &&
						result.Name == "old-dashboard" &&
						result.Resource == "Dashboard" &&
						result.Group == "dashboards" &&
						result.Error != nil &&
						result.Error.Error() == "removing resource from file dashboards/old.json: delete failed"
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedCalls: 1,
		},
		{
			name: "too many errors",
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/test.json",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				// Mock too many errors
				progress.On("TooManyErrors").Return(fmt.Errorf("too many errors occurred"))
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedError: "too many errors occurred",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockVersioned(t)
			repoResources := resources.NewMockRepositoryResources(t)
			progress := jobs.NewMockJobProgressRecorder(t)

			tt.setupMocks(repo, repoResources, progress)

			err := IncrementalSync(context.Background(), repo, tt.previousRef, tt.currentRef, repoResources, progress)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
