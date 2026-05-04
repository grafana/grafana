package sync

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func newPermissiveMockQuotaTracker(t *testing.T) quotas.QuotaTracker {
	qt := quotas.NewMockQuotaTracker(t)
	qt.On("TryAcquire").Return(true).Maybe()
	qt.On("Release").Maybe()
	qt.On("AllowOverLimit", mock.Anything).Maybe()
	return qt
}

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

	err := IncrementalSync(ctx, repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), false)
	require.EqualError(t, err, "context canceled")
}

type incrementalSyncTestCase struct {
	name          string
	setupMocks    func(*repository.MockVersioned, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder)
	quotaTracker  quotas.QuotaTracker
	previousRef   string
	currentRef    string
	expectedError string
}

func runIncrementalSyncTests(t *testing.T, tests []incrementalSyncTestCase) {
	t.Helper()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockVersioned(t)
			repoResources := resources.NewMockRepositoryResources(t)
			progress := jobs.NewMockJobProgressRecorder(t)

			tt.setupMocks(repo, repoResources, progress)

			err := IncrementalSync(context.Background(), repo, tt.previousRef, tt.currentRef, repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), tt.quotaTracker, false)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestIncrementalSync(t *testing.T) {
	permissiveQt := newPermissiveMockQuotaTracker(t)
	runIncrementalSyncTests(t, []incrementalSyncTestCase{
		{
			name:         "same commit as last time",
			quotaTracker: permissiveQt,
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				progress.On("SetFinalMessage", mock.Anything, "same commit as last time").Return()
			},
			previousRef: "old-ref",
			currentRef:  "old-ref",
		},
		{
			name:         "no changes between commits",
			quotaTracker: permissiveQt,
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return([]repository.VersionedFileChange{}, nil)
				progress.On("SetFinalMessage", mock.Anything, "no changes detected between commits").Return()
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "error comparing files",
			quotaTracker: permissiveQt,
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(nil, fmt.Errorf("compare error"))
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedError: "compare files error: compare error",
		},
		{
			name:         "successful sync with file changes",
			quotaTracker: permissiveQt,
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

				// Mock HasDirPathFailedCreation checks
				progress.On("HasDirPathFailedCreation", "dashboards/test.json").Return(false)
				progress.On("HasDirPathFailedCreation", "alerts/alert.yaml").Return(false)

				// Mock successful resource writes
				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "new-ref").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)
				repoResources.On("WriteResourceFromFile", mock.Anything, "alerts/alert.yaml", "new-ref").
					Return("test-alert", schema.GroupVersionKind{Kind: "Alert", Group: "alerts"}, nil)

				// Mock progress recording
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionCreated && result.Path() == "dashboards/test.json"
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionUpdated && result.Path() == "alerts/alert.yaml"
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "unsupported file path with valid folder",
			quotaTracker: permissiveQt,
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

				progress.On("HasDirPathFailedCreation", "unsupported/path/file.txt").Return(false)

				repoResources.On("EnsureFolderPathExist", mock.Anything, "unsupported/path/", "new-ref").
					Return("test-folder", nil)

				progress.On("Record", mock.Anything, jobs.NewFolderResult("unsupported/path/").
					WithAction(repository.FileActionCreated).
					Build()).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "unsupported file path with invalid folder",
			quotaTracker: permissiveQt,
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

				progress.On("HasDirPathFailedCreation", ".unsupported/path/file.txt").Return(false)

				progress.On("HasDirPathFailedCreation", ".unsupported/path/file.txt").Return(false)

				progress.On("Record", mock.Anything, jobs.NewPathOnlyResult(
					".unsupported/path/file.txt",
				).WithAction(repository.FileActionIgnored).
					Build()).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "file deletion",
			quotaTracker: permissiveQt,
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

				repoResources.On("RemoveResourceFromFile", mock.Anything, "dashboards/old.json", "old-ref").
					Return("old-dashboard", "", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, jobs.NewGroupKindResult(
					"old-dashboard",
					"dashboards",
					"Dashboard",
				).WithPath("dashboards/old.json").
					WithAction(repository.FileActionDeleted).
					Build()).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "file rename",
			quotaTracker: permissiveQt,
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

				progress.On("HasDirPathFailedCreation", "dashboards/new.json").Return(false)

				repoResources.On("RenameResourceFile", mock.Anything, "dashboards/old.json", "old-ref", "dashboards/new.json", "new-ref").
					Return("renamed-dashboard", "", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, jobs.NewGroupKindResult(
					"renamed-dashboard",
					"dashboards",
					"Dashboard",
				).WithPath("dashboards/new.json").
					WithPreviousPath("dashboards/old.json").
					WithAction(repository.FileActionRenamed).
					Build()).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "update with PreviousRef calls ReplaceResourceFromFileByRef",
			quotaTracker: permissiveQt,
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action:      repository.FileActionUpdated,
						Path:        "dashboards/dash.json",
						Ref:         "new-ref",
						PreviousRef: "old-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
				progress.On("HasDirPathFailedCreation", "dashboards/dash.json").Return(false)

				repoResources.On("ReplaceResourceFromFileByRef", mock.Anything, "dashboards/dash.json", "new-ref", "old-ref").
					Return("replaced-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionUpdated &&
						result.Path() == "dashboards/dash.json" &&
						result.Name() == "replaced-dashboard" &&
						result.Kind() == "Dashboard" &&
						result.Group() == "dashboards" &&
						result.Error() == nil
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "update without PreviousRef falls back to WriteResourceFromFile",
			quotaTracker: permissiveQt,
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionUpdated,
						Path:   "dashboards/dash.json",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
				progress.On("HasDirPathFailedCreation", "dashboards/dash.json").Return(false)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/dash.json", "new-ref").
					Return("written-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionUpdated &&
						result.Path() == "dashboards/dash.json" &&
						result.Name() == "written-dashboard" &&
						result.Error() == nil
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "file ignored",
			quotaTracker: permissiveQt,
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

				progress.On("HasDirPathFailedCreation", "dashboards/ignored.json").Return(false)

				progress.On("Record", mock.Anything, jobs.NewPathOnlyResult(
					"dashboards/ignored.json",
				).WithAction(repository.FileActionIgnored).Build()).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "too many errors",
			quotaTracker: permissiveQt,
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

				progress.On("TooManyErrors").Return(fmt.Errorf("too many errors occurred"))
			},
			previousRef:   "old-ref",
			currentRef:    "new-ref",
			expectedError: "too many errors occurred",
		},
	})
}

func TestIncrementalSync_FolderMetadataRequiresReader(t *testing.T) {
	repo := repository.NewMockVersioned(t)
	repoResources := resources.NewMockRepositoryResources(t)
	progress := jobs.NewMockJobProgressRecorder(t)

	repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return([]repository.VersionedFileChange{
		{
			Action: repository.FileActionUpdated,
			Path:   "alpha/_folder.json",
			Ref:    "new-ref",
		},
	}, nil)

	err := IncrementalSync(
		context.Background(),
		repo,
		"old-ref",
		"new-ref",
		repoResources,
		progress,
		tracing.NewNoopTracerService(),
		jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()),
		newPermissiveMockQuotaTracker(t),
		true,
	)

	require.EqualError(t, err, "folder metadata incremental sync requires repository.Reader")
}

func TestIncrementalSync_CrossBoundaryDirectoryChanges(t *testing.T) {
	permissiveQt := newPermissiveMockQuotaTracker(t)

	// Directory entries (trailing-slash paths) from cross-boundary renames are
	// skipped entirely — the individual file-level changes already handle
	// folder creation (via WriteResourceFromFile → EnsureFolderPathExist) and
	// deletion (via affectedFolders / orphan cleanup). Neither
	// WriteResourceFromFile nor RemoveResourceFromFile should be called.
	runIncrementalSyncTests(t, []incrementalSyncTestCase{
		{
			name:         "directory created is skipped",
			quotaTracker: permissiveQt,
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "new-team/",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
				progress.On("HasDirPathFailedCreation", "new-team/").Return(false)
				progress.On("TooManyErrors").Return(nil)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionCreated &&
						result.Path() == "new-team/"
				})).Return()
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "directory deleted is skipped",
			quotaTracker: permissiveQt,
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action:      repository.FileActionDeleted,
						Path:        "old-team/",
						PreviousRef: "old-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
				progress.On("TooManyErrors").Return(nil)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionDeleted &&
						result.Path() == "old-team/"
				})).Return()
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
	})
}

func TestIncrementalSync_ErrorHandling(t *testing.T) {
	permissiveQt := newPermissiveMockQuotaTracker(t)
	runIncrementalSyncTests(t, []incrementalSyncTestCase{
		{
			name:         "error creating folder",
			quotaTracker: permissiveQt,
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

				progress.On("HasDirPathFailedCreation", "unsupported/path/file.txt").Return(false)

				repoResources.On("EnsureFolderPathExist", mock.Anything, "unsupported/path/", "new-ref").
					Return("", fmt.Errorf("failed to create folder"))

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionIgnored &&
						result.Path() == "unsupported/path/file.txt" &&
						result.Error() != nil &&
						result.Error().Error() == "failed to create folder"
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "error writing resource",
			quotaTracker: permissiveQt,
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

				progress.On("HasDirPathFailedCreation", "dashboards/test.json").Return(false)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "new-ref").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, fmt.Errorf("write failed"))

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionCreated &&
						result.Path() == "dashboards/test.json" &&
						result.Name() == "test-dashboard" &&
						result.Kind() == "Dashboard" &&
						result.Group() == "dashboards" &&
						result.Error() != nil &&
						result.Error().Error() == "writing resource from file dashboards/test.json: write failed"
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "error replacing resource with PreviousRef",
			quotaTracker: permissiveQt,
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action:      repository.FileActionUpdated,
						Path:        "dashboards/dash.json",
						Ref:         "new-ref",
						PreviousRef: "old-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
				progress.On("HasDirPathFailedCreation", "dashboards/dash.json").Return(false)

				repoResources.On("ReplaceResourceFromFileByRef", mock.Anything, "dashboards/dash.json", "new-ref", "old-ref").
					Return("dash-name", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, fmt.Errorf("replace failed"))

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionUpdated &&
						result.Path() == "dashboards/dash.json" &&
						result.Name() == "dash-name" &&
						result.Kind() == "Dashboard" &&
						result.Group() == "dashboards" &&
						result.Error() != nil &&
						result.Error().Error() == "replacing resource from file dashboards/dash.json: replace failed"
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "error deleting resource",
			quotaTracker: permissiveQt,
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

				repoResources.On("RemoveResourceFromFile", mock.Anything, "dashboards/old.json", "old-ref").
					Return("old-dashboard", "", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, fmt.Errorf("delete failed"))

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionDeleted &&
						result.Path() == "dashboards/old.json" &&
						result.Name() == "old-dashboard" &&
						result.Kind() == "Dashboard" &&
						result.Group() == "dashboards" &&
						result.Error() != nil &&
						result.Error().Error() == "removing resource from file dashboards/old.json: delete failed"
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
	})
}

func TestIncrementalSync_QuotaEnforcement(t *testing.T) {
	runIncrementalSyncTests(t, []incrementalSyncTestCase{
		{
			name:         "quota exceeded skips creation",
			quotaTracker: quotas.NewInMemoryQuotaTracker(10, 10),
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

				progress.On("HasDirPathFailedCreation", "dashboards/test.json").Return(false)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					var qe *quotas.QuotaExceededError
					return result.Action() == repository.FileActionIgnored &&
						result.Path() == "dashboards/test.json" &&
						result.Warning() != nil &&
						errors.As(result.Warning(), &qe) &&
						result.Warning().Error() == "resource quota exceeded, skipping creation of dashboards/test.json"
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "quota allows creation then blocks when full",
			quotaTracker: quotas.NewInMemoryQuotaTracker(9, 10),
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/first.json",
						Ref:    "new-ref",
					},
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/second.json",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 2).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				progress.On("HasDirPathFailedCreation", "dashboards/first.json").Return(false)
				progress.On("HasDirPathFailedCreation", "dashboards/second.json").Return(false)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/first.json", "new-ref").
					Return("first-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionCreated && result.Path() == "dashboards/first.json" && result.Error() == nil
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					var qe *quotas.QuotaExceededError
					return result.Action() == repository.FileActionIgnored &&
						result.Path() == "dashboards/second.json" &&
						result.Warning() != nil &&
						errors.As(result.Warning(), &qe) &&
						result.Warning().Error() == "resource quota exceeded, skipping creation of dashboards/second.json"
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "deletion releases quota allowing subsequent creation",
			quotaTracker: quotas.NewInMemoryQuotaTracker(10, 10),
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action:      repository.FileActionDeleted,
						Path:        "dashboards/old.json",
						PreviousRef: "old-ref",
					},
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/new.json",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 2).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				progress.On("HasDirPathFailedCreation", "dashboards/new.json").Return(false)

				repoResources.On("RemoveResourceFromFile", mock.Anything, "dashboards/old.json", "old-ref").
					Return("old-dashboard", "", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/new.json", "new-ref").
					Return("new-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionDeleted && result.Path() == "dashboards/old.json"
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionCreated && result.Path() == "dashboards/new.json" && result.Error() == nil
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "update does not consume quota",
			quotaTracker: quotas.NewInMemoryQuotaTracker(10, 10),
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionUpdated,
						Path:   "dashboards/existing.json",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				progress.On("HasDirPathFailedCreation", "dashboards/existing.json").Return(false)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/existing.json", "new-ref").
					Return("existing-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionUpdated &&
						result.Path() == "dashboards/existing.json" &&
						result.Error() == nil
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "creation before deletion in diff still succeeds at quota limit due to sorting",
			quotaTracker: quotas.NewInMemoryQuotaTracker(10, 10),
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/new.json",
						Ref:    "new-ref",
					},
					{
						Action:      repository.FileActionDeleted,
						Path:        "dashboards/old.json",
						PreviousRef: "old-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 2).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				progress.On("HasDirPathFailedCreation", "dashboards/new.json").Return(false)

				repoResources.On("RemoveResourceFromFile", mock.Anything, "dashboards/old.json", "old-ref").
					Return("old-dashboard", "", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/new.json", "new-ref").
					Return("new-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionDeleted && result.Path() == "dashboards/old.json"
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionCreated && result.Path() == "dashboards/new.json" && result.Error() == nil
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
		{
			name:         "failed deletion does not release quota",
			quotaTracker: quotas.NewInMemoryQuotaTracker(10, 10),
			setupMocks: func(repo *repository.MockVersioned, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action:      repository.FileActionDeleted,
						Path:        "dashboards/old.json",
						PreviousRef: "old-ref",
					},
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/new.json",
						Ref:    "new-ref",
					},
				}
				repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 2).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()

				progress.On("HasDirPathFailedCreation", "dashboards/new.json").Return(false)

				repoResources.On("RemoveResourceFromFile", mock.Anything, "dashboards/old.json", "old-ref").
					Return("old-dashboard", "", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, fmt.Errorf("delete failed"))

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionDeleted && result.Path() == "dashboards/old.json" && result.Error() != nil
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					var qe *quotas.QuotaExceededError
					return result.Action() == repository.FileActionIgnored &&
						result.Path() == "dashboards/new.json" &&
						result.Warning() != nil &&
						errors.As(result.Warning(), &qe) &&
						result.Warning().Error() == "resource quota exceeded, skipping creation of dashboards/new.json"
				})).Return()

				progress.On("TooManyErrors").Return(nil)
			},
			previousRef: "old-ref",
			currentRef:  "new-ref",
		},
	})
}

// TestSortChangesByActionPriority was removed when sortChangesByActionPriority
// was deleted. Ordering is now handled by the shared apply pipeline's phased
// orchestrator (file deletions -> folder creations -> file renames ->
// folder deletions -> file creations -> old folder cleanup), which makes the
// per-action priority sort redundant.

type compositeRepo struct {
	*repository.MockVersioned
	*repository.MockReader
}

func TestIncrementalSync_CleanupOrphanedFolders(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*compositeRepo, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder)
		expectedError string
	}{
		{
			name: "delete folder when it no longer exists in git",
			setupMocks: func(repo *compositeRepo, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action:      repository.FileActionDeleted,
						Path:        "dashboards/old.json",
						PreviousRef: "old-ref",
					},
				}
				repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
				repoResources.On("RemoveResourceFromFile", mock.Anything, "dashboards/old.json", "old-ref").
					Return("old-dashboard", "folder-uid", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				// if the folder is not found in git, there should be a call to remove the folder from grafana
				repo.MockReader.On("Read", mock.Anything, "dashboards/", "new-ref").
					Return((*repository.FileInfo)(nil), repository.ErrFileNotFound)
				progress.On("HasDirPathFailedCreation", "dashboards/").Return(false)
				progress.On("HasDirPathFailedDeletion", "dashboards/").Return(false)
				progress.On("HasChildPathFailedCreation", "dashboards/").Return(false)
				progress.On("HasChildPathFailedUpdate", "dashboards/").Return(false)
				repoResources.On("RemoveFolder", mock.Anything, "folder-uid").Return(nil)

				progress.On("Record", mock.Anything, mock.Anything).Return()
				progress.On("TooManyErrors").Return(nil)
			},
		},
		{
			name: "keep folder when it still exists in git",
			setupMocks: func(repo *compositeRepo, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action:      repository.FileActionDeleted,
						Path:        "dashboards/old.json",
						PreviousRef: "old-ref",
					},
				}
				repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
				repoResources.On("RemoveResourceFromFile", mock.Anything, "dashboards/old.json", "old-ref").
					Return("old-dashboard", "folder-uid", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				// if the folder still exists in git, there should not be a call to delete it from grafana
				repo.MockReader.On("Read", mock.Anything, "dashboards/", "new-ref").
					Return(&repository.FileInfo{}, nil)

				progress.On("Record", mock.Anything, mock.Anything).Return()
				progress.On("TooManyErrors").Return(nil)
			},
		},
		{
			name: "delete multiple folders when they no longer exist in git",
			setupMocks: func(repo *compositeRepo, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder) {
				changes := []repository.VersionedFileChange{
					{
						Action:      repository.FileActionDeleted,
						Path:        "dashboards/old.json",
						PreviousRef: "old-ref",
					},
					{
						Action:      repository.FileActionDeleted,
						Path:        "alerts/old-alert.yaml",
						PreviousRef: "old-ref",
					},
				}
				repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
				progress.On("SetTotal", mock.Anything, 2).Return()
				progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
				progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
				repoResources.On("RemoveResourceFromFile", mock.Anything, "dashboards/old.json", "old-ref").
					Return("old-dashboard", "folder-uid-1", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)
				repoResources.On("RemoveResourceFromFile", mock.Anything, "alerts/old-alert.yaml", "old-ref").
					Return("old-alert", "folder-uid-2", schema.GroupVersionKind{Kind: "Alert", Group: "alerts"}, nil)

				progress.On("Record", mock.Anything, mock.Anything).Return()
				progress.On("TooManyErrors").Return(nil)

				progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
				progress.On("HasDirPathFailedDeletion", mock.Anything).Return(false)
				progress.On("HasChildPathFailedCreation", mock.Anything).Return(false)
				progress.On("HasChildPathFailedUpdate", mock.Anything).Return(false)

				// both not found in git, both should be deleted
				repo.MockReader.On("Read", mock.Anything, "dashboards/", "new-ref").
					Return((*repository.FileInfo)(nil), repository.ErrFileNotFound)
				repo.MockReader.On("Read", mock.Anything, "alerts/", "new-ref").
					Return((*repository.FileInfo)(nil), repository.ErrFileNotFound)
				repoResources.On("RemoveFolder", mock.Anything, "folder-uid-1").Return(nil)
				repoResources.On("RemoveFolder", mock.Anything, "folder-uid-2").Return(nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockVersioned := repository.NewMockVersioned(t)
			mockReader := repository.NewMockReader(t)
			repo := &compositeRepo{
				MockVersioned: mockVersioned,
				MockReader:    mockReader,
			}
			repoResources := resources.NewMockRepositoryResources(t)
			progress := jobs.NewMockJobProgressRecorder(t)

			tt.setupMocks(repo, repoResources, progress)

			err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), false)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestIncrementalSync_MissingFolderMetadata(t *testing.T) {
	t.Run("flag enabled detects missing folder metadata", func(t *testing.T) {
		mockVersioned := repository.NewMockVersioned(t)
		mockReader := repository.NewMockReader(t)
		repo := &compositeRepo{
			MockVersioned: mockVersioned,
			MockReader:    mockReader,
		}
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{
				Action: repository.FileActionCreated,
				Path:   "myfolder/dashboard.json",
				Ref:    "new-ref",
			},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
		allowFolderTreeSeed(repoResources, &provisioning.ResourceList{})
		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("HasDirPathFailedCreation", "myfolder/dashboard.json").Return(false)
		repoResources.On("WriteResourceFromFile", mock.Anything, "myfolder/dashboard.json", "new-ref").
			Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)
		progress.On("TooManyErrors").Return(nil)

		// ReadTree returns a folder without _folder.json
		mockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "myfolder", Blob: false},
			{Path: "myfolder/dashboard.json", Blob: true},
		}, nil)

		// Expect warning record for the missing folder metadata
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Warning() != nil && errors.Is(result.Warning(), resources.ErrMissingFolderMetadata) &&
				result.Action() == repository.FileActionIgnored
		})).Return().Once()

		// Also expect the normal record for the dashboard write
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionCreated && result.Path() == "myfolder/dashboard.json"
		})).Return()

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)
		mockReader.AssertCalled(t, "ReadTree", mock.Anything, "new-ref")
	})

	t.Run("flag disabled skips detection", func(t *testing.T) {
		repo := repository.NewMockVersioned(t)
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return([]repository.VersionedFileChange{}, nil)
		progress.On("SetFinalMessage", mock.Anything, "no changes detected between commits").Return()

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), false)
		require.NoError(t, err)
	})

	t.Run("ReadTree error fails the job", func(t *testing.T) {
		mockVersioned := repository.NewMockVersioned(t)
		mockReader := repository.NewMockReader(t)
		repo := &compositeRepo{
			MockVersioned: mockVersioned,
			MockReader:    mockReader,
		}
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{
				Action: repository.FileActionCreated,
				Path:   "dashboards/test.json",
				Ref:    "new-ref",
			},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
		allowFolderTreeSeed(repoResources, &provisioning.ResourceList{})
		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("HasDirPathFailedCreation", "dashboards/test.json").Return(false)
		repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "new-ref").
			Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionCreated && result.Path() == "dashboards/test.json"
		})).Return()
		progress.On("TooManyErrors").Return(nil)

		mockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry(nil), fmt.Errorf("read tree failed"))

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.Error(t, err)
		require.Contains(t, err.Error(), "detect missing folder metadata: read tree failed")
	})
}

func TestIncrementalSync_InvalidFolderMetadata(t *testing.T) {
	t.Run("created invalid metadata records created warning and still applies fallback folder replay", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "alpha/_folder.json", Ref: "new-ref"},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil).Once()
		repoResources.On("SetTree", mock.Anything).Return().Once()
		repo.MockReader.On("Read", mock.Anything, "alpha/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"Broken"}}`),
		}, nil).Once()

		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("TooManyErrors").Return(nil)
		progress.On("HasDirPathFailedCreation", "alpha/").Return(false)

		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/", "new-ref", mock.Anything).Return("hash-uid", nil)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionUpdated && result.Path() == "alpha/" && result.Name() == "hash-uid"
		})).Return().Once()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionCreated &&
				result.Path() == "alpha/" &&
				result.Warning() != nil &&
				errors.Is(result.Warning(), resources.ErrInvalidFolderMetadata)
		})).Return().Once()

		repo.MockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "alpha", Blob: false},
			{Path: "alpha/_folder.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)
	})

	t.Run("updated invalid metadata records updated warning without replacing the folder", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "new-ref"},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "stable-uid"},
			},
		}, nil).Once()
		repoResources.On("SetTree", mock.Anything).Return().Once()
		repo.MockReader.On("Read", mock.Anything, "alpha/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"Broken"}}`),
		}, nil).Once()

		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("TooManyErrors").Return(nil)
		progress.On("HasDirPathFailedCreation", "alpha/").Return(false)

		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/", "new-ref", mock.Anything).Return("stable-uid", nil)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionUpdated && result.Path() == "alpha/" && result.Name() == "stable-uid"
		})).Return().Once()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionUpdated &&
				result.Path() == "alpha/" &&
				result.Warning() != nil &&
				errors.Is(result.Warning(), resources.ErrInvalidFolderMetadata)
		})).Return().Once()

		repo.MockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "alpha", Blob: false},
			{Path: "alpha/_folder.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)
		repoResources.AssertNotCalled(t, "RemoveFolder", mock.Anything, mock.Anything)
	})

	t.Run("renamed invalid metadata records renamed warning and recreates the folder", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "moved/", PreviousPath: "team/", PreviousRef: "old-ref", Ref: "new-ref"},
			{Action: repository.FileActionRenamed, Path: "moved/_folder.json", PreviousPath: "team/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "team/", Group: resources.FolderResource.Group, Name: "stable-uid"},
			},
		}, nil).Once()
		repoResources.On("SetTree", mock.Anything).Return().Once()
		repo.MockReader.On("Read", mock.Anything, "moved/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"Broken"}}`),
		}, nil).Once()
		repo.MockReader.On("Read", mock.Anything, "team/", "new-ref").Return((*repository.FileInfo)(nil), repository.ErrFileNotFound).Once()

		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("TooManyErrors").Return(nil)
		progress.On("HasDirPathFailedCreation", "moved/").Return(false)
		progress.On("HasDirPathFailedCreation", "team/").Return(false)
		progress.On("HasDirPathFailedDeletion", "team/").Return(false)
		progress.On("HasChildPathFailedCreation", "team/").Return(false)
		progress.On("HasChildPathFailedUpdate", "team/").Return(false)

		repoResources.On("RenameFolderPath", mock.Anything, "team/", "old-ref", "moved/", "new-ref").Return("stable-uid", nil).Once()
		repoResources.On("RemoveFolder", mock.Anything, "stable-uid").Return(nil).Once()

		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionRenamed &&
				result.Path() == "moved/" &&
				result.Error() == nil
		})).Return().Once()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionDeleted &&
				result.Path() == "team/" &&
				result.Name() == "stable-uid"
		})).Return().Once()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionRenamed &&
				result.Path() == "moved/" &&
				result.Warning() != nil &&
				errors.Is(result.Warning(), resources.ErrInvalidFolderMetadata)
		})).Return().Once()

		repo.MockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "moved", Blob: false},
			{Path: "moved/_folder.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)
	})
}

func TestIncrementalSync_FolderRouting(t *testing.T) {
	t.Run("updated folder path routes to EnsureFolderPathExist", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{
				Action: repository.FileActionUpdated,
				Path:   "alpha/",
				Ref:    "new-ref",
			},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("HasDirPathFailedCreation", "alpha/").Return(false)
		progress.On("TooManyErrors").Return(nil)

		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/", "new-ref", mock.Anything).
			Return("alpha-folder", nil)

		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionUpdated &&
				result.Path() == "alpha/" &&
				result.Name() == "alpha-folder" &&
				result.Error() == nil
		})).Return()

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), false)
		require.NoError(t, err)

		repoResources.AssertCalled(t, "EnsureFolderPathExist", mock.Anything, "alpha/", "new-ref", mock.Anything)
	})

	t.Run("_folder.json with disabled flag routes to WriteResourceFromFile", func(t *testing.T) {
		repo := repository.NewMockVersioned(t)
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{
				Action: repository.FileActionUpdated,
				Path:   "alpha/_folder.json",
				Ref:    "new-ref",
			},
		}
		repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("HasDirPathFailedCreation", "alpha/_folder.json").Return(false)
		progress.On("TooManyErrors").Return(nil)

		repoResources.On("WriteResourceFromFile", mock.Anything, "alpha/_folder.json", "new-ref").
			Return("folder-resource", schema.GroupVersionKind{Kind: "Folder", Group: "folders"}, nil)

		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionUpdated &&
				result.Path() == "alpha/_folder.json"
		})).Return()

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), false)
		require.NoError(t, err)

		repoResources.AssertCalled(t, "WriteResourceFromFile", mock.Anything, "alpha/_folder.json", "new-ref")
		repoResources.AssertNotCalled(t, "EnsureFolderPathExist", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("EnsureFolderPathExist error is recorded for updated folder path", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{
				Action: repository.FileActionUpdated,
				Path:   "gamma/",
				Ref:    "new-ref",
			},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("HasDirPathFailedCreation", "gamma/").Return(false)
		progress.On("TooManyErrors").Return(nil)

		repoResources.On("EnsureFolderPathExist", mock.Anything, "gamma/", "new-ref", mock.Anything).
			Return("", fmt.Errorf("folder update failed"))

		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionUpdated &&
				result.Path() == "gamma/" &&
				result.Error() != nil &&
				result.Error().Error() == "re-parenting child folder at gamma/: folder update failed"
		})).Return()

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), false)
		require.NoError(t, err)
	})
}

func TestIncrementalSync_FolderMetadataDeletion(t *testing.T) {
	t.Run("metadata deletion re-parents children and deletes old folder", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "alpha/_folder.json", PreviousRef: "old-ref"},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "stable-uid"},
				{Path: "alpha/dash.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1", Folder: "stable-uid"},
			},
		}, nil).Once()
		repoResources.On("SetTree", mock.Anything).Return().Once()

		repo.MockReader.On("Read", mock.Anything, "alpha/", "new-ref").Return(&repository.FileInfo{}, nil)

		progress.On("SetTotal", mock.Anything, mock.Anything).Return()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(nil)
		progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
		progress.On("HasDirPathFailedDeletion", mock.Anything).Return(false)
		progress.On("HasChildPathFailedCreation", mock.Anything).Return(false)
		progress.On("HasChildPathFailedUpdate", mock.Anything).Return(false)

		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/", "new-ref", mock.Anything).
			Return("hash-uid", nil)
		repoResources.On("WriteResourceFromFile", mock.Anything, "alpha/dash.json", "new-ref").
			Return("dash1", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboard.grafana.app"}, nil)
		repoResources.On("RemoveFolder", mock.Anything, "stable-uid").Return(nil)

		progress.On("Record", mock.Anything, mock.Anything).Return()

		repo.MockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "alpha", Blob: false},
			{Path: "alpha/dash.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)

		repoResources.AssertCalled(t, "EnsureFolderPathExist", mock.Anything, "alpha/", "new-ref", mock.Anything)
		repoResources.AssertCalled(t, "WriteResourceFromFile", mock.Anything, "alpha/dash.json", "new-ref")
		repoResources.AssertCalled(t, "RemoveFolder", mock.Anything, "stable-uid")
	})

	t.Run("deleted _folder.json is skipped in apply phase", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		// _folder.json deletion + dashboard creation in same commit
		changes := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "beta/_folder.json", PreviousRef: "old-ref"},
			{Action: repository.FileActionCreated, Path: "beta/new-dash.json", Ref: "new-ref"},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)

		// No existing folder — just ensure the deletion is skipped gracefully
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil).Once()
		repoResources.On("SetTree", mock.Anything).Return().Once()

		progress.On("SetTotal", mock.Anything, mock.Anything).Return()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(nil)
		progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)

		repoResources.On("WriteResourceFromFile", mock.Anything, "beta/new-dash.json", "new-ref").
			Return("new-dash", schema.GroupVersionKind{Kind: "Dashboard"}, nil)

		progress.On("Record", mock.Anything, mock.Anything).Return()

		repo.MockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "beta", Blob: false},
			{Path: "beta/new-dash.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)

		// _folder.json deletion should NOT reach RemoveResourceFromFile
		repoResources.AssertNotCalled(t, "RemoveResourceFromFile", mock.Anything, "beta/_folder.json", mock.Anything)
		repoResources.AssertCalled(t, "WriteResourceFromFile", mock.Anything, "beta/new-dash.json", "new-ref")
	})
}

func TestIncrementalSync_FolderUIDChange(t *testing.T) {
	t.Run("UID change re-parents children and deletes old folder", func(t *testing.T) {
		mockVersioned := repository.NewMockVersioned(t)
		mockReader := repository.NewMockReader(t)
		repo := &compositeRepo{
			MockVersioned: mockVersioned,
			MockReader:    mockReader,
		}
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "new-ref"},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "old-alpha-uid"},
				{Path: "alpha/dash.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1", Folder: "old-alpha-uid"},
			},
		}, nil).Once()
		repoResources.On("SetTree", mock.Anything).Return().Once()

		repo.MockReader.On("Read", mock.Anything, "alpha/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: folderJSON(t, "new-alpha-uid", "Alpha Renamed"),
			Hash: "newhash",
		}, nil)

		progress.On("SetTotal", mock.Anything, 2).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("TooManyErrors").Return(nil)
		progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
		progress.On("HasDirPathFailedDeletion", mock.Anything).Return(false)
		progress.On("HasChildPathFailedCreation", mock.Anything).Return(false)
		progress.On("HasChildPathFailedUpdate", mock.Anything).Return(false)

		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/", "new-ref", mock.Anything, mock.Anything).
			Return("new-alpha-uid", nil)
		repoResources.On("WriteResourceFromFile", mock.Anything, "alpha/dash.json", "new-ref").
			Return("dash1", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboard.grafana.app"}, nil)
		repoResources.On("RemoveFolder", mock.Anything, "old-alpha-uid").Return(nil)

		progress.On("Record", mock.Anything, mock.Anything).Return()

		repo.MockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "alpha", Blob: false},
			{Path: "alpha/_folder.json", Blob: true},
			{Path: "alpha/dash.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)

		repoResources.AssertCalled(t, "EnsureFolderPathExist", mock.Anything, "alpha/", "new-ref", mock.Anything, mock.Anything)
		repoResources.AssertCalled(t, "WriteResourceFromFile", mock.Anything, "alpha/dash.json", "new-ref")
		repoResources.AssertCalled(t, "RemoveFolder", mock.Anything, "old-alpha-uid")
	})

	t.Run("child folder re-parented via EnsureFolderPathExist", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "new-ref"},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "old-uid"},
				{Path: "alpha/beta", Group: resources.FolderResource.Group, Name: "beta-uid", Folder: "old-uid"},
			},
		}, nil).Once()
		repoResources.On("SetTree", mock.Anything).Return().Once()

		repo.MockReader.On("Read", mock.Anything, "alpha/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: folderJSON(t, "new-uid", "Alpha"),
			Hash: "h",
		}, nil)

		progress.On("SetTotal", mock.Anything, 2).Return()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(nil)
		progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
		progress.On("HasDirPathFailedDeletion", mock.Anything).Return(false)
		progress.On("HasChildPathFailedCreation", mock.Anything).Return(false)
		progress.On("HasChildPathFailedUpdate", mock.Anything).Return(false)

		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/", "new-ref", mock.Anything, mock.Anything).Return("new-uid", nil)
		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/beta/", "new-ref", mock.Anything).Return("beta-uid", nil)
		repoResources.On("RemoveFolder", mock.Anything, "old-uid").Return(nil)

		progress.On("Record", mock.Anything, mock.Anything).Return()

		repo.MockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "alpha", Blob: false},
			{Path: "alpha/_folder.json", Blob: true},
			{Path: "alpha/beta", Blob: false},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)

		repoResources.AssertCalled(t, "EnsureFolderPathExist", mock.Anything, "alpha/beta/", "new-ref", mock.Anything)
	})

	t.Run("old folder not deleted when new folder creation fails", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		changes := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "new-ref"},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "old-uid"},
			},
		}, nil).Once()
		repoResources.On("SetTree", mock.Anything).Return().Once()

		repo.MockReader.On("Read", mock.Anything, "alpha/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: folderJSON(t, "new-uid", "Alpha"),
			Hash: "h",
		}, nil)

		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(nil)
		progress.On("HasDirPathFailedCreation", "alpha/").Return(false).Once()
		progress.On("HasDirPathFailedCreation", "alpha/").Return(true).Once()

		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/", "new-ref", mock.Anything, mock.Anything).
			Return("", fmt.Errorf("creation failed"))

		progress.On("Record", mock.Anything, mock.Anything).Return()

		repo.MockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "alpha", Blob: false},
			{Path: "alpha/_folder.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)

		repoResources.AssertNotCalled(t, "RemoveFolder", mock.Anything, "old-uid")
	})
}

func TestDeleteFolders(t *testing.T) {
	tracer := tracing.NewNoopTracerService()

	t.Run("empty map is a no-op", func(t *testing.T) {
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		deleteFolders(context.Background(), nil, repoResources, progress, tracer)
		deleteFolders(context.Background(), []folderDeletion{}, repoResources, progress, tracer)

		repoResources.AssertNotCalled(t, "RemoveFolder", mock.Anything, mock.Anything)
		progress.AssertNotCalled(t, "Record", mock.Anything, mock.Anything)
	})

	t.Run("deletes single folder and records result", func(t *testing.T) {
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		progress.On("HasDirPathFailedCreation", "dashboards/").Return(false)
		progress.On("HasDirPathFailedDeletion", "dashboards/").Return(false)
		progress.On("HasChildPathFailedCreation", "dashboards/").Return(false)
		progress.On("HasChildPathFailedUpdate", "dashboards/").Return(false)
		repoResources.On("RemoveFolder", mock.Anything, "folder-uid").Return(nil)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionDeleted &&
				r.Path() == "dashboards/" &&
				r.Name() == "folder-uid" &&
				r.Error() == nil
		})).Return()

		deleteFolders(context.Background(), []folderDeletion{
			{Path: "dashboards/", UID: "folder-uid"},
		}, repoResources, progress, tracer)

		repoResources.AssertCalled(t, "RemoveFolder", mock.Anything, "folder-uid")
	})

	t.Run("records error when RemoveFolder fails", func(t *testing.T) {
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		progress.On("HasDirPathFailedCreation", "alpha/").Return(false)
		progress.On("HasDirPathFailedDeletion", "alpha/").Return(false)
		progress.On("HasChildPathFailedCreation", "alpha/").Return(false)
		progress.On("HasChildPathFailedUpdate", "alpha/").Return(false)
		repoResources.On("RemoveFolder", mock.Anything, "bad-uid").Return(fmt.Errorf("not found"))
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionDeleted &&
				r.Name() == "bad-uid" &&
				r.Error() != nil &&
				r.Error().Error() == "delete folder bad-uid: not found"
		})).Return()

		deleteFolders(context.Background(), []folderDeletion{
			{Path: "alpha/", UID: "bad-uid"},
		}, repoResources, progress, tracer)
	})

	t.Run("skips folder when creation failed", func(t *testing.T) {
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		progress.On("HasDirPathFailedCreation", "alpha/").Return(true)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionIgnored &&
				r.Name() == "old-uid" &&
				r.Warning() != nil
		})).Return()

		deleteFolders(context.Background(), []folderDeletion{
			{Path: "alpha/", UID: "old-uid"},
		}, repoResources, progress, tracer)

		repoResources.AssertNotCalled(t, "RemoveFolder", mock.Anything, mock.Anything)
	})

	t.Run("skips folder when child deletion failed", func(t *testing.T) {
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		progress.On("HasDirPathFailedCreation", "dashboards/").Return(false)
		progress.On("HasDirPathFailedDeletion", "dashboards/").Return(true)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionIgnored &&
				r.Name() == "folder-uid" &&
				r.Warning() != nil
		})).Return()

		deleteFolders(context.Background(), []folderDeletion{
			{Path: "dashboards/", UID: "folder-uid"},
		}, repoResources, progress, tracer)

		repoResources.AssertNotCalled(t, "RemoveFolder", mock.Anything, mock.Anything)
	})

	t.Run("skips folder when child reparenting failed", func(t *testing.T) {
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		progress.On("HasDirPathFailedCreation", "alpha/").Return(false)
		progress.On("HasDirPathFailedDeletion", "alpha/").Return(false)
		progress.On("HasChildPathFailedCreation", "alpha/").Return(true)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionIgnored &&
				r.Name() == "old-uid" &&
				r.Warning() != nil
		})).Return()

		deleteFolders(context.Background(), []folderDeletion{
			{Path: "alpha/", UID: "old-uid"},
		}, repoResources, progress, tracer)

		repoResources.AssertNotCalled(t, "RemoveFolder", mock.Anything, mock.Anything)
	})

	t.Run("skips folder when child update failed", func(t *testing.T) {
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		progress.On("HasDirPathFailedCreation", "alpha/").Return(false)
		progress.On("HasDirPathFailedDeletion", "alpha/").Return(false)
		progress.On("HasChildPathFailedCreation", "alpha/").Return(false)
		progress.On("HasChildPathFailedUpdate", "alpha/").Return(true)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionIgnored &&
				r.Name() == "old-uid" &&
				r.Warning() != nil
		})).Return()

		deleteFolders(context.Background(), []folderDeletion{
			{Path: "alpha/", UID: "old-uid"},
		}, repoResources, progress, tracer)

		repoResources.AssertNotCalled(t, "RemoveFolder", mock.Anything, mock.Anything)
	})

	t.Run("processes deepest paths first", func(t *testing.T) {
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
		progress.On("HasDirPathFailedDeletion", mock.Anything).Return(false)
		progress.On("HasChildPathFailedCreation", mock.Anything).Return(false)
		progress.On("HasChildPathFailedUpdate", mock.Anything).Return(false)

		var deletionOrder []string
		repoResources.On("RemoveFolder", mock.Anything, mock.Anything).
			Run(func(args mock.Arguments) {
				deletionOrder = append(deletionOrder, args.Get(1).(string))
			}).Return(nil)
		progress.On("Record", mock.Anything, mock.Anything).Return()

		deleteFolders(context.Background(), []folderDeletion{
			{Path: "a/", UID: "shallow-uid"},
			{Path: "a/b/", UID: "mid-uid"},
			{Path: "a/b/c/", UID: "deep-uid"},
			{Path: "x/y/z/w/", UID: "deepest-uid"},
		}, repoResources, progress, tracer)

		require.Len(t, deletionOrder, 4)
		require.Equal(t, "deepest-uid", deletionOrder[0])
		require.Equal(t, "deep-uid", deletionOrder[1])
		require.Equal(t, "mid-uid", deletionOrder[2])
		require.Equal(t, "shallow-uid", deletionOrder[3])
	})
}

func folderJSON(t *testing.T, uid, title string) []byte {
	t.Helper()
	manifest := resources.NewFolderManifest(uid, title, resources.FolderKind)
	data, err := json.Marshal(manifest)
	require.NoError(t, err)
	return data
}

func newCompositeRepoWithConfig(t *testing.T) *compositeRepo {
	t.Helper()

	mockVersioned := repository.NewMockVersioned(t)
	mockReader := repository.NewMockReader(t)
	mockReader.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
	}).Maybe()

	return &compositeRepo{
		MockVersioned: mockVersioned,
		MockReader:    mockReader,
	}
}

func TestDeduplicateFolderDeletions(t *testing.T) {
	t.Run("removes exact duplicates", func(t *testing.T) {
		input := []folderDeletion{
			{Path: "a/", UID: "uid-1"},
			{Path: "b/", UID: "uid-2"},
			{Path: "a/", UID: "uid-1"},
		}
		result := deduplicateFolderDeletions(input)
		require.Equal(t, []folderDeletion{
			{Path: "a/", UID: "uid-1"},
			{Path: "b/", UID: "uid-2"},
		}, result)
	})

	t.Run("keeps entries with same path but different UIDs", func(t *testing.T) {
		input := []folderDeletion{
			{Path: "a/", UID: "uid-1"},
			{Path: "a/", UID: "uid-2"},
		}
		result := deduplicateFolderDeletions(input)
		require.Equal(t, input, result)
	})

	t.Run("returns empty for empty input", func(t *testing.T) {
		result := deduplicateFolderDeletions(nil)
		require.Empty(t, result)
	})
}

func allowFolderTreeSeed(repoResources *resources.MockRepositoryResources, target *provisioning.ResourceList) {
	repoResources.On("List", mock.Anything).Return(target, nil).Maybe()
	repoResources.On("SetTree", mock.Anything).Return().Maybe()
}
