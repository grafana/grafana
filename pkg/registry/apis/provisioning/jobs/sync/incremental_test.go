package sync

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

				repoResources.On("EnsureFolderPathExist", mock.Anything, "unsupported/path/").
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
					WithAction(repository.FileActionRenamed).
					Build()).Return()

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

				repoResources.On("EnsureFolderPathExist", mock.Anything, "unsupported/path/").
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

func TestSortChangesByActionPriority(t *testing.T) {
	diff := []repository.VersionedFileChange{
		{Action: repository.FileActionCreated, Path: "dashboards/new1.json"},
		{Action: repository.FileActionIgnored, Path: "dashboards/ignored.json"},
		{Action: repository.FileActionDeleted, Path: "dashboards/old1.json"},
		{Action: repository.FileActionUpdated, Path: "dashboards/updated.json"},
		{Action: repository.FileActionCreated, Path: "dashboards/new2.json"},
		{Action: repository.FileActionRenamed, Path: "dashboards/renamed.json"},
		{Action: repository.FileActionDeleted, Path: "dashboards/old2.json"},
	}

	sortChangesByActionPriority(diff)

	expectedOrder := []repository.FileAction{
		repository.FileActionDeleted,
		repository.FileActionDeleted,
		repository.FileActionRenamed,
		repository.FileActionUpdated,
		repository.FileActionCreated,
		repository.FileActionCreated,
		repository.FileActionIgnored,
	}
	for i, change := range diff {
		require.Equal(t, expectedOrder[i], change.Action, "index %d: expected %s, got %s", i, expectedOrder[i], change.Action)
	}
}

func TestSortChangesByActionPriority_StableOrder(t *testing.T) {
	diff := []repository.VersionedFileChange{
		{Action: repository.FileActionCreated, Path: "dashboards/b.json"},
		{Action: repository.FileActionCreated, Path: "dashboards/a.json"},
		{Action: repository.FileActionDeleted, Path: "dashboards/d.json"},
		{Action: repository.FileActionDeleted, Path: "dashboards/c.json"},
	}

	sortChangesByActionPriority(diff)

	require.Equal(t, repository.FileActionDeleted, diff[0].Action)
	require.Equal(t, "dashboards/d.json", diff[0].Path)
	require.Equal(t, repository.FileActionDeleted, diff[1].Action)
	require.Equal(t, "dashboards/c.json", diff[1].Path)
	require.Equal(t, repository.FileActionCreated, diff[2].Action)
	require.Equal(t, "dashboards/b.json", diff[2].Path)
	require.Equal(t, repository.FileActionCreated, diff[3].Action)
	require.Equal(t, "dashboards/a.json", diff[3].Path)
}

func TestSortChangesByActionPriority_PathTypeOrder(t *testing.T) {
	diff := []repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json"},
		{Action: repository.FileActionUpdated, Path: "myfolder/"},
		{Action: repository.FileActionCreated, Path: "parent/child.json"},
		{Action: repository.FileActionCreated, Path: "parent/"},
		{Action: repository.FileActionDeleted, Path: "old/"},
		{Action: repository.FileActionDeleted, Path: "old/dashboard.json"},
	}

	sortChangesByActionPriority(diff)

	require.Equal(t, []repository.VersionedFileChange{
		{Action: repository.FileActionDeleted, Path: "old/dashboard.json"},
		{Action: repository.FileActionDeleted, Path: "old/"},
		{Action: repository.FileActionUpdated, Path: "myfolder/"},
		{Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json"},
		{Action: repository.FileActionCreated, Path: "parent/"},
		{Action: repository.FileActionCreated, Path: "parent/child.json"},
	}, diff)
}

type compositeRepo struct {
	*repository.MockVersioned
	*repository.MockReader
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
				repo.MockReader.On("Read", mock.Anything, "dashboards/", "").
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
				repo.MockReader.On("Read", mock.Anything, "dashboards/", "").
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
				repo.MockReader.On("Read", mock.Anything, "dashboards/", "").
					Return((*repository.FileInfo)(nil), repository.ErrFileNotFound)
				repo.MockReader.On("Read", mock.Anything, "alerts/", "").
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

func TestPlanFolderMetadataChanges(t *testing.T) {
	t.Run("creates synthetic folder update and direct child updates for metadata creation on existing folder", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "child-folder-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/child/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		}, nil).Once()
		repo.MockReader.On("Read", mock.Anything, "myfolder/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"Updated Title"}}`),
			Hash: "newhash",
		}, nil).Once()

		plan, err := planFolderMetadataChanges(
			context.Background(), diff, repo, repoResources, "new-ref", tracing.NewNoopTracerService(), true,
		)

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "myfolder/child/", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json", Ref: "new-ref"},
		}, plan.filteredDiff)
		require.Equal(t, []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "hash-uid",
		}}, plan.replacedFolders)
	})

	t.Run("creates synthetic folder create when metadata is added for a brand-new folder", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil).Once()
		repo.MockReader.On("Read", mock.Anything, "myfolder/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"Title"}}`),
			Hash: "hash",
		}, nil).Once()

		plan, err := planFolderMetadataChanges(
			context.Background(), diff, repo, repoResources, "new-ref", tracing.NewNoopTracerService(), true,
		)

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/", Ref: "new-ref"},
		}, plan.filteredDiff)
		require.Empty(t, plan.replacedFolders)
	})

	t.Run("leaves unsupported metadata actions in diff", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/_folder.json", Ref: "new-ref"},
			{Action: repository.FileActionDeleted, Path: "other/_folder.json", PreviousRef: "old-ref"},
			{Action: repository.FileActionRenamed, Path: "renamed/_folder.json", PreviousPath: "old/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "dashboards/test.json", Ref: "new-ref"},
		}

		plan, err := planFolderMetadataChanges(
			context.Background(), diff, repo, repoResources, "new-ref", tracing.NewNoopTracerService(), true,
		)

		require.NoError(t, err)
		require.Equal(t, diff, plan.filteredDiff)
		require.Nil(t, plan.target)
	})

	t.Run("falls back to original metadata file change when metadata read fails", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil).Once()
		repo.MockReader.On("Read", mock.Anything, "myfolder/_folder.json", "new-ref").
			Return((*repository.FileInfo)(nil), fmt.Errorf("read failed")).Once()

		plan, err := planFolderMetadataChanges(
			context.Background(), diff, repo, repoResources, "new-ref", tracing.NewNoopTracerService(), true,
		)

		require.NoError(t, err)
		require.Equal(t, diff, plan.filteredDiff)
	})
}

func TestApplyIncrementalChanges_FolderMetadataDiff(t *testing.T) {
	t.Run("applies synthetic folder update before child updates", func(t *testing.T) {
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)
		tracer := tracing.NewNoopTracerService()
		ctx, span := tracer.Start(context.Background(), "test")
		defer span.End()

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "dashboards/test.json", Ref: "new-ref"},
		}
		existingFoldersByPath := map[string]*provisioning.ResourceListItem{
			"myfolder/": {
				Name:     "old-hash",
				Group:    resources.FolderResource.Group,
				Resource: resources.FolderResource.Resource,
				Path:     "myfolder/",
			},
		}

		var sequence []string
		progress.On("TooManyErrors").Return(nil).Twice()
		repoResources.On("RemoveFolderFromTree", "old-hash").Run(func(mock.Arguments) {
			sequence = append(sequence, "remove-folder-from-tree")
		}).Once()
		repoResources.On("EnsureFolderPathExist", mock.Anything, "myfolder/").Run(func(mock.Arguments) {
			sequence = append(sequence, "ensure-folder-path")
		}).Return("stable-uid", nil).Once()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionUpdated &&
				r.Path() == "myfolder/" &&
				r.Name() == "stable-uid" &&
				r.Error() == nil
		})).Run(func(mock.Arguments) {
			sequence = append(sequence, "record-folder")
		}).Return().Once()
		progress.On("HasDirPathFailedCreation", "dashboards/test.json").Return(false).Once()
		repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "new-ref").
			Run(func(mock.Arguments) { sequence = append(sequence, "write-dashboard") }).
			Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil).Once()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionUpdated &&
				r.Path() == "dashboards/test.json" &&
				r.Name() == "test-dashboard" &&
				r.Error() == nil
		})).Run(func(mock.Arguments) {
			sequence = append(sequence, "record-dashboard")
		}).Return().Once()

		affectedFolders, err := applyIncrementalChanges(ctx, diff, existingFoldersByPath, nil, repoResources, progress, tracer, span, newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)
		require.Empty(t, affectedFolders)
		require.Equal(t, []string{
			"remove-folder-from-tree",
			"ensure-folder-path",
			"record-folder",
			"write-dashboard",
			"record-dashboard",
		}, sequence)
	})

	t.Run("reorders updated folders ahead of updated child resources", func(t *testing.T) {
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)
		tracer := tracing.NewNoopTracerService()
		ctx, span := tracer.Start(context.Background(), "test")
		defer span.End()

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}
		existingFoldersByPath := map[string]*provisioning.ResourceListItem{
			"myfolder/": {
				Name:     "old-hash",
				Group:    resources.FolderResource.Group,
				Resource: resources.FolderResource.Resource,
				Path:     "myfolder/",
			},
		}

		var sequence []string
		progress.On("TooManyErrors").Return(nil).Twice()
		repoResources.On("RemoveFolderFromTree", "old-hash").Run(func(mock.Arguments) {
			sequence = append(sequence, "remove-folder-from-tree")
		}).Once()
		repoResources.On("EnsureFolderPathExist", mock.Anything, "myfolder/").Run(func(mock.Arguments) {
			sequence = append(sequence, "ensure-folder-path")
		}).Return("stable-uid", nil).Once()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionUpdated &&
				r.Path() == "myfolder/" &&
				r.Name() == "stable-uid" &&
				r.Error() == nil
		})).Run(func(mock.Arguments) {
			sequence = append(sequence, "record-folder")
		}).Return().Once()
		progress.On("HasDirPathFailedCreation", "myfolder/dashboard.json").Return(false).Once()
		repoResources.On("WriteResourceFromFile", mock.Anything, "myfolder/dashboard.json", "new-ref").
			Run(func(mock.Arguments) { sequence = append(sequence, "write-dashboard") }).
			Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil).Once()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionUpdated &&
				r.Path() == "myfolder/dashboard.json" &&
				r.Name() == "test-dashboard" &&
				r.Error() == nil
		})).Run(func(mock.Arguments) {
			sequence = append(sequence, "record-dashboard")
		}).Return().Once()

		affectedFolders, err := applyIncrementalChanges(ctx, diff, existingFoldersByPath, nil, repoResources, progress, tracer, span, newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)
		require.Empty(t, affectedFolders)
		require.Equal(t, []string{
			"remove-folder-from-tree",
			"ensure-folder-path",
			"record-folder",
			"write-dashboard",
			"record-dashboard",
		}, sequence)
	})

	t.Run("deletes replaced folder after applying synthetic updates", func(t *testing.T) {
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)
		tracer := tracing.NewNoopTracerService()
		ctx, span := tracer.Start(context.Background(), "test")
		defer span.End()

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json", Ref: "new-ref"},
		}
		existingFoldersByPath := map[string]*provisioning.ResourceListItem{
			"myfolder/": {
				Name:     "old-hash",
				Group:    resources.FolderResource.Group,
				Resource: resources.FolderResource.Resource,
				Path:     "myfolder/",
			},
		}
		replacedFolders := []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "old-hash",
		}}

		progress.On("TooManyErrors").Return(nil).Times(3)
		repoResources.On("RemoveFolderFromTree", "old-hash").Return().Once()
		repoResources.On("EnsureFolderPathExist", mock.Anything, "myfolder/").Return("stable-uid", nil).Once()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionUpdated &&
				r.Path() == "myfolder/"
		})).Return().Once()
		progress.On("HasDirPathFailedCreation", "myfolder/dashboard.json").Return(false).Once()
		repoResources.On("WriteResourceFromFile", mock.Anything, "myfolder/dashboard.json", "new-ref").
			Return("dash", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil).Once()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionUpdated &&
				r.Path() == "myfolder/dashboard.json" &&
				r.Name() == "dash"
		})).Return().Once()
		repoResources.On("RemoveFolder", mock.Anything, "old-hash").Return(nil).Once()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionDeleted &&
				r.Path() == "myfolder/" &&
				r.Name() == "old-hash" &&
				r.Error() == nil
		})).Return().Once()

		affectedFolders, err := applyIncrementalChanges(ctx, diff, existingFoldersByPath, replacedFolders, repoResources, progress, tracer, span, newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)
		require.Empty(t, affectedFolders)
	})
}

func TestIncrementalSync_PlansFolderMetadataBeforeSettingProgressTotal(t *testing.T) {
	repo := newCompositeRepoWithConfig(t)
	repoResources := resources.NewMockRepositoryResources(t)
	progress := jobs.NewMockJobProgressRecorder(t)

	changes := []repository.VersionedFileChange{
		{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		{Action: repository.FileActionUpdated, Path: "dashboards/test.json", Ref: "new-ref"},
	}
	repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil).Once()

	var sequence []string
	repo.MockReader.On("Read", mock.Anything, "myfolder/_folder.json", "new-ref").Run(func(mock.Arguments) {
		sequence = append(sequence, "read-folder-meta")
	}).Return(&repository.FileInfo{
		Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"My Folder"}}`),
		Hash: "newhash",
	}, nil).Once()
	repoResources.On("List", mock.Anything).Run(func(mock.Arguments) {
		sequence = append(sequence, "list-resources")
	}).Return(&provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{
				Name:     "old-hash",
				Group:    resources.FolderResource.Group,
				Resource: resources.FolderResource.Resource,
				Path:     "myfolder/",
			},
		},
	}, nil).Once()
	repoResources.On("SetTree", mock.Anything).Return().Once()
	progress.On("SetTotal", mock.Anything, 2).Run(func(mock.Arguments) {
		sequence = append(sequence, "set-total")
	}).Return().Once()
	progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return().Once()
	progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return().Once()
	progress.On("TooManyErrors").Return(nil).Times(3)
	repoResources.On("RemoveFolderFromTree", "old-hash").Return().Once()
	repoResources.On("EnsureFolderPathExist", mock.Anything, "myfolder/").Return("stable-uid", nil).Once()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Action() == repository.FileActionUpdated && r.Path() == "myfolder/" && r.Name() == "stable-uid"
	})).Return().Once()
	progress.On("HasDirPathFailedCreation", "dashboards/test.json").Return(false).Once()
	repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "new-ref").
		Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil).Once()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Action() == repository.FileActionUpdated && r.Path() == "dashboards/test.json"
	})).Return().Once()
	repoResources.On("RemoveFolder", mock.Anything, "old-hash").Return(nil).Once()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Action() == repository.FileActionDeleted && r.Path() == "myfolder/" && r.Name() == "old-hash"
	})).Return().Once()
	repo.MockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{}, nil).Once()

	err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
	require.NoError(t, err)
	require.Equal(t, "set-total", sequence[2])
	require.ElementsMatch(t, []string{"read-folder-meta", "list-resources"}, sequence[:2])
}

func TestIncrementalSync_FolderMetadataRouting(t *testing.T) {
	t.Run("updated _folder.json routes to EnsureFolderPathExist", func(t *testing.T) {
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
				Action: repository.FileActionUpdated,
				Path:   "alpha/_folder.json",
				Ref:    "new-ref",
			},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("HasDirPathFailedCreation", "alpha/_folder.json").Return(false)
		progress.On("TooManyErrors").Return(nil)

		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/").
			Return("alpha-folder", nil)

		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionUpdated &&
				result.Path() == "alpha/_folder.json" &&
				result.Name() == "alpha-folder" &&
				result.Error() == nil
		})).Return()

		mockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "alpha", Blob: false},
			{Path: "alpha/_folder.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)

		repoResources.AssertNotCalled(t, "WriteResourceFromFile", mock.Anything, "alpha/_folder.json", mock.Anything)
		repoResources.AssertCalled(t, "EnsureFolderPathExist", mock.Anything, "alpha/")
	})

	t.Run("created _folder.json routes to EnsureFolderPathExist", func(t *testing.T) {
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
				Path:   "beta/_folder.json",
				Ref:    "new-ref",
			},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("HasDirPathFailedCreation", "beta/_folder.json").Return(false)
		progress.On("TooManyErrors").Return(nil)

		repoResources.On("EnsureFolderPathExist", mock.Anything, "beta/").
			Return("beta-folder", nil)

		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionCreated &&
				result.Path() == "beta/_folder.json" &&
				result.Name() == "beta-folder" &&
				result.Error() == nil
		})).Return()

		mockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "beta", Blob: false},
			{Path: "beta/_folder.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)

		repoResources.AssertNotCalled(t, "WriteResourceFromFile", mock.Anything, "beta/_folder.json", mock.Anything)
		repoResources.AssertCalled(t, "EnsureFolderPathExist", mock.Anything, "beta/")
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
		repoResources.AssertNotCalled(t, "EnsureFolderPathExist", mock.Anything, mock.Anything)
	})

	t.Run("EnsureFolderPathExist error is recorded", func(t *testing.T) {
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
				Action: repository.FileActionUpdated,
				Path:   "gamma/_folder.json",
				Ref:    "new-ref",
			},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
		progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
		progress.On("HasDirPathFailedCreation", "gamma/_folder.json").Return(false)
		progress.On("TooManyErrors").Return(nil)

		repoResources.On("EnsureFolderPathExist", mock.Anything, "gamma/").
			Return("", fmt.Errorf("folder update failed"))

		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action() == repository.FileActionUpdated &&
				result.Path() == "gamma/_folder.json" &&
				result.Error() != nil &&
				result.Error().Error() == "updating folder metadata at gamma/: folder update failed"
		})).Return()

		mockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "gamma", Blob: false},
			{Path: "gamma/_folder.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)
	})
}

func TestPlanFolderMetadataChanges(t *testing.T) {
	tracer := tracing.NewNoopTracerService()

	t.Run("no _folder.json updates returns diff unchanged", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "alpha/dash.json", Ref: "ref1"},
		}
		result, replaced, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Empty(t, replaced)
		require.Equal(t, diff, result)
	})

	t.Run("no existing folder means no UID change", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "ref1"},
		}
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)

		result, replaced, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Empty(t, replaced)
		require.Equal(t, diff, result)
	})

	t.Run("same UID means no change", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "ref1"},
		}
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "stable-uid"},
			},
		}, nil)
		repo.On("Config").Return(&provisioning.Repository{})
		repo.On("Read", mock.Anything, "alpha/_folder.json", "ref1").Return(&repository.FileInfo{
			Data: folderJSON(t, "stable-uid", "Alpha"),
			Hash: "abc",
		}, nil)

		result, replaced, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Empty(t, replaced)
		require.Equal(t, diff, result)
	})

	t.Run("UID change emits children and tracks old UID", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "ref1"},
		}
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "old-uid"},
				{Path: "alpha/dash.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1", Folder: "old-uid"},
			},
		}, nil)
		repoResources.On("RemoveFolderFromTree", "old-uid").Return()
		repo.On("Config").Return(&provisioning.Repository{})
		repo.On("Read", mock.Anything, "alpha/_folder.json", "ref1").Return(&repository.FileInfo{
			Data: folderJSON(t, "new-uid", "Alpha"),
			Hash: "abc",
		}, nil)

		result, replaced, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Len(t, replaced, 1)
		require.Equal(t, "alpha/", replaced[0].Path)
		require.Equal(t, "old-uid", replaced[0].OldUID)
		require.Len(t, result, 2)
		require.Equal(t, "alpha/_folder.json", result[0].Path)
		require.Equal(t, "alpha/dash.json", result[1].Path)
		require.Equal(t, repository.FileActionUpdated, result[1].Action)
	})

	t.Run("child already in diff is not duplicated", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "ref1"},
			{Action: repository.FileActionUpdated, Path: "alpha/dash.json", Ref: "ref1"},
		}
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "old-uid"},
				{Path: "alpha/dash.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1", Folder: "old-uid"},
			},
		}, nil)
		repoResources.On("RemoveFolderFromTree", "old-uid").Return()
		repo.On("Config").Return(&provisioning.Repository{})
		repo.On("Read", mock.Anything, "alpha/_folder.json", "ref1").Return(&repository.FileInfo{
			Data: folderJSON(t, "new-uid", "Alpha"),
			Hash: "abc",
		}, nil)

		result, replaced, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Len(t, replaced, 1)
		require.Len(t, result, 2, "should not add duplicate child")
	})

	t.Run("child folder gets trailing slash", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "ref1"},
		}
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "old-uid"},
				{Path: "alpha/beta", Group: resources.FolderResource.Group, Name: "beta-uid", Folder: "old-uid"},
			},
		}, nil)
		repoResources.On("RemoveFolderFromTree", "old-uid").Return()
		repo.On("Config").Return(&provisioning.Repository{})
		repo.On("Read", mock.Anything, "alpha/_folder.json", "ref1").Return(&repository.FileInfo{
			Data: folderJSON(t, "new-uid", "Alpha"),
			Hash: "abc",
		}, nil)

		result, _, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Len(t, result, 2)
		require.Equal(t, "alpha/beta/", result[1].Path)
	})

	t.Run("child folder with own _folder.json in diff is not duplicated", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "ref1"},
			{Action: repository.FileActionUpdated, Path: "alpha/beta/_folder.json", Ref: "ref1"},
		}
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "old-uid"},
				{Path: "alpha/beta", Group: resources.FolderResource.Group, Name: "beta-uid", Folder: "old-uid"},
				{Path: "alpha/dash.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1", Folder: "old-uid"},
			},
		}, nil)
		repoResources.On("RemoveFolderFromTree", "old-uid").Return()
		repo.On("Config").Return(&provisioning.Repository{})
		repo.On("Read", mock.Anything, "alpha/_folder.json", "ref1").Return(&repository.FileInfo{
			Data: folderJSON(t, "new-uid", "Alpha"),
			Hash: "abc",
		}, nil)
		repo.On("Read", mock.Anything, "alpha/beta/_folder.json", "ref1").Return(&repository.FileInfo{
			Data: folderJSON(t, "beta-uid", "Beta"),
			Hash: "def",
		}, nil)

		result, replaced, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Len(t, replaced, 1)
		require.Len(t, result, 3, "should not add synthetic alpha/beta/ because alpha/beta/_folder.json is already in diff")
		require.Equal(t, "alpha/_folder.json", result[0].Path)
		require.Equal(t, "alpha/beta/_folder.json", result[1].Path)
		require.Equal(t, "alpha/dash.json", result[2].Path)
	})

	t.Run("List error is propagated", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "ref1"},
		}
		repoResources.On("List", mock.Anything).Return((*provisioning.ResourceList)(nil), fmt.Errorf("list failed"))

		_, _, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.Error(t, err)
		require.Contains(t, err.Error(), "list existing resources: list failed")
	})

	t.Run("deleted _folder.json with UID transition emits folder update and children", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "alpha/_folder.json", PreviousRef: "old-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "stable-uid"},
				{Path: "alpha/dash.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1", Folder: "stable-uid"},
			},
		}, nil)

		repo.On("Config").Return(&provisioning.Repository{})
		repo.On("Read", mock.Anything, "alpha/", "ref1").Return(&repository.FileInfo{}, nil)
		repoResources.On("RemoveFolderFromTree", "stable-uid").Return()

		result, replaced, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Len(t, replaced, 1)
		require.Equal(t, "alpha/", replaced[0].Path)
		require.Equal(t, "stable-uid", replaced[0].OldUID)

		// Original _folder.json deletion + synthetic folder dir update + synthetic child update
		require.Len(t, result, 3)
		require.Equal(t, "alpha/_folder.json", result[0].Path)
		require.Equal(t, repository.FileActionDeleted, result[0].Action)

		var hasFolderDirUpdate, hasChildUpdate bool
		for _, r := range result {
			if r.Path == "alpha/" && r.Action == repository.FileActionUpdated {
				hasFolderDirUpdate = true
			}
			if r.Path == "alpha/dash.json" && r.Action == repository.FileActionUpdated {
				hasChildUpdate = true
			}
		}
		require.True(t, hasFolderDirUpdate, "should emit folder dir update")
		require.True(t, hasChildUpdate, "should emit child update")
	})

	t.Run("deleted _folder.json when directory is also gone schedules old folder deletion", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "alpha/_folder.json", PreviousRef: "old-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "stable-uid"},
			},
		}, nil)

		repo.On("Read", mock.Anything, "alpha/", "ref1").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound)

		result, replaced, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Len(t, replaced, 1, "old folder should be scheduled for deletion even when directory is gone")
		require.Equal(t, "stable-uid", replaced[0].OldUID)
		require.Equal(t, "alpha/", replaced[0].Path)
		require.Equal(t, diff, result)
	})

	t.Run("deleted _folder.json when folder not in Grafana skips transition", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "alpha/_folder.json", PreviousRef: "old-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)

		result, replaced, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Empty(t, replaced)
		require.Equal(t, diff, result)
	})

	t.Run("deleted _folder.json with same UID emits folder update only", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "alpha/_folder.json", PreviousRef: "old-ref"},
		}

		hashUID := resources.ParseFolder("alpha/", "").ID
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: hashUID},
				{Path: "alpha/dash.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "d1", Folder: hashUID},
			},
		}, nil)

		repo.On("Config").Return(&provisioning.Repository{})
		repo.On("Read", mock.Anything, "alpha/", "ref1").Return(&repository.FileInfo{}, nil)

		result, replaced, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Empty(t, replaced, "same UID should not produce a replacement")

		require.Len(t, result, 2)
		require.Equal(t, "alpha/_folder.json", result[0].Path)

		var hasFolderDirUpdate bool
		for _, r := range result {
			if r.Path == "alpha/" && r.Action == repository.FileActionUpdated {
				hasFolderDirUpdate = true
			}
		}
		require.True(t, hasFolderDirUpdate, "should emit folder dir update to clear metadata hash")
	})

	t.Run("deleted _folder.json children already in diff are not duplicated", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "alpha/_folder.json", PreviousRef: "old-ref"},
			{Action: repository.FileActionUpdated, Path: "alpha/dash.json", Ref: "ref1"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "stable-uid"},
				{Path: "alpha/dash.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "d1", Folder: "stable-uid"},
			},
		}, nil)

		repo.On("Config").Return(&provisioning.Repository{})
		repo.On("Read", mock.Anything, "alpha/", "ref1").Return(&repository.FileInfo{}, nil)
		repoResources.On("RemoveFolderFromTree", "stable-uid").Return()

		result, replaced, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.NoError(t, err)
		require.Len(t, replaced, 1)
		// Original deletion + original dash update + synthetic folder dir update (child not duplicated)
		require.Len(t, result, 3, "child already in diff should not be duplicated")
	})

	t.Run("transient Read error during deletion is propagated", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "alpha/_folder.json", PreviousRef: "old-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "stable-uid"},
			},
		}, nil)

		repo.On("Read", mock.Anything, "alpha/", "ref1").
			Return((*repository.FileInfo)(nil), fmt.Errorf("connection reset"))

		_, _, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.Error(t, err)
		require.Contains(t, err.Error(), "read folder directory alpha/")
		require.Contains(t, err.Error(), "connection reset")
	})

	t.Run("List error is propagated for deletions too", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repoResources := resources.NewMockRepositoryResources(t)

		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "alpha/_folder.json", PreviousRef: "old-ref"},
		}
		repoResources.On("List", mock.Anything).Return((*provisioning.ResourceList)(nil), fmt.Errorf("list failed"))

		_, _, err := planFolderMetadataChanges(context.Background(), repo, "ref1", diff, repoResources, tracer)
		require.Error(t, err)
		require.Contains(t, err.Error(), "list existing resources: list failed")
	})
}

func TestIncrementalSync_FolderMetadataDeletion(t *testing.T) {
	t.Run("metadata deletion re-parents children and deletes old folder", func(t *testing.T) {
		mockVersioned := repository.NewMockVersioned(t)
		mockReader := repository.NewMockReader(t)
		repo := &compositeRepo{
			MockVersioned: mockVersioned,
			MockReader:    mockReader,
		}
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
		}, nil)

		mockReader.On("Config").Return(&provisioning.Repository{})
		mockReader.On("Read", mock.Anything, "alpha/", "new-ref").Return(&repository.FileInfo{}, nil)

		progress.On("SetTotal", mock.Anything, mock.Anything).Return()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(nil)
		progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
		progress.On("HasDirPathFailedDeletion", mock.Anything).Return(false)
		progress.On("HasChildPathFailedCreation", mock.Anything).Return(false)
		progress.On("HasChildPathFailedUpdate", mock.Anything).Return(false)

		repoResources.On("RemoveFolderFromTree", "stable-uid").Return()
		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/").
			Return("hash-uid", nil)
		repoResources.On("WriteResourceFromFile", mock.Anything, "alpha/dash.json", "new-ref").
			Return("dash1", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboard.grafana.app"}, nil)
		repoResources.On("RemoveFolder", mock.Anything, "stable-uid").Return(nil)

		progress.On("Record", mock.Anything, mock.Anything).Return()

		mockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "alpha", Blob: false},
			{Path: "alpha/dash.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)

		repoResources.AssertCalled(t, "RemoveFolderFromTree", "stable-uid")
		repoResources.AssertCalled(t, "EnsureFolderPathExist", mock.Anything, "alpha/")
		repoResources.AssertCalled(t, "WriteResourceFromFile", mock.Anything, "alpha/dash.json", "new-ref")
		repoResources.AssertCalled(t, "RemoveFolder", mock.Anything, "stable-uid")
	})

	t.Run("deleted _folder.json is skipped in apply phase", func(t *testing.T) {
		mockVersioned := repository.NewMockVersioned(t)
		mockReader := repository.NewMockReader(t)
		repo := &compositeRepo{
			MockVersioned: mockVersioned,
			MockReader:    mockReader,
		}
		repoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)

		// _folder.json deletion + dashboard creation in same commit
		changes := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "beta/_folder.json", PreviousRef: "old-ref"},
			{Action: repository.FileActionCreated, Path: "beta/new-dash.json", Ref: "new-ref"},
		}
		repo.MockVersioned.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)

		// No existing folder — just ensure the deletion is skipped gracefully
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)

		progress.On("SetTotal", mock.Anything, mock.Anything).Return()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(nil)
		progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)

		repoResources.On("WriteResourceFromFile", mock.Anything, "beta/new-dash.json", "new-ref").
			Return("new-dash", schema.GroupVersionKind{Kind: "Dashboard"}, nil)

		progress.On("Record", mock.Anything, mock.Anything).Return()

		mockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
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
		}, nil)

		mockReader.On("Config").Return(&provisioning.Repository{})
		mockReader.On("Read", mock.Anything, "alpha/_folder.json", "new-ref").Return(&repository.FileInfo{
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

		repoResources.On("RemoveFolderFromTree", "old-alpha-uid").Return()
		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/").
			Return("new-alpha-uid", nil)
		repoResources.On("WriteResourceFromFile", mock.Anything, "alpha/dash.json", "new-ref").
			Return("dash1", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboard.grafana.app"}, nil)
		repoResources.On("RemoveFolder", mock.Anything, "old-alpha-uid").Return(nil)

		progress.On("Record", mock.Anything, mock.Anything).Return()

		mockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "alpha", Blob: false},
			{Path: "alpha/_folder.json", Blob: true},
			{Path: "alpha/dash.json", Blob: true},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)

		repoResources.AssertCalled(t, "RemoveFolderFromTree", "old-alpha-uid")
		repoResources.AssertCalled(t, "EnsureFolderPathExist", mock.Anything, "alpha/")
		repoResources.AssertCalled(t, "WriteResourceFromFile", mock.Anything, "alpha/dash.json", "new-ref")
		repoResources.AssertCalled(t, "RemoveFolder", mock.Anything, "old-alpha-uid")
	})

	t.Run("child folder re-parented via EnsureFolderPathExist", func(t *testing.T) {
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
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "old-uid"},
				{Path: "alpha/beta", Group: resources.FolderResource.Group, Name: "beta-uid", Folder: "old-uid"},
			},
		}, nil)

		mockReader.On("Config").Return(&provisioning.Repository{})
		mockReader.On("Read", mock.Anything, "alpha/_folder.json", "new-ref").Return(&repository.FileInfo{
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

		repoResources.On("RemoveFolderFromTree", "old-uid").Return()
		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/").Return("new-uid", nil)
		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/beta/").Return("beta-uid", nil)
		repoResources.On("RemoveFolder", mock.Anything, "old-uid").Return(nil)

		progress.On("Record", mock.Anything, mock.Anything).Return()

		mockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
			{Path: "alpha", Blob: false},
			{Path: "alpha/_folder.json", Blob: true},
			{Path: "alpha/beta", Blob: false},
		}, nil)

		err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t), true)
		require.NoError(t, err)

		repoResources.AssertCalled(t, "EnsureFolderPathExist", mock.Anything, "alpha/beta/")
	})

	t.Run("old folder not deleted when new folder creation fails", func(t *testing.T) {
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
				{Path: "alpha/", Group: resources.FolderResource.Group, Name: "old-uid"},
			},
		}, nil)

		mockReader.On("Config").Return(&provisioning.Repository{})
		mockReader.On("Read", mock.Anything, "alpha/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: folderJSON(t, "new-uid", "Alpha"),
			Hash: "h",
		}, nil)

		progress.On("SetTotal", mock.Anything, 1).Return()
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(nil)
		progress.On("HasDirPathFailedCreation", "alpha/_folder.json").Return(false)
		progress.On("HasDirPathFailedCreation", "alpha/").Return(true)

		repoResources.On("RemoveFolderFromTree", "old-uid").Return()
		repoResources.On("EnsureFolderPathExist", mock.Anything, "alpha/").
			Return("", fmt.Errorf("creation failed"))

		progress.On("Record", mock.Anything, mock.Anything).Return()

		mockReader.On("ReadTree", mock.Anything, "new-ref").Return([]repository.FileTreeEntry{
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
		deleteFolders(context.Background(), map[string]string{}, repoResources, progress, tracer)

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

		deleteFolders(context.Background(), map[string]string{
			"dashboards/": "folder-uid",
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

		deleteFolders(context.Background(), map[string]string{
			"alpha/": "bad-uid",
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

		deleteFolders(context.Background(), map[string]string{
			"alpha/": "old-uid",
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

		deleteFolders(context.Background(), map[string]string{
			"dashboards/": "folder-uid",
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

		deleteFolders(context.Background(), map[string]string{
			"alpha/": "old-uid",
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

		deleteFolders(context.Background(), map[string]string{
			"alpha/": "old-uid",
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

		deleteFolders(context.Background(), map[string]string{
			"a/":       "shallow-uid",
			"a/b/":     "mid-uid",
			"a/b/c/":   "deep-uid",
			"x/y/z/w/": "deepest-uid",
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
	manifest := resources.NewFolderManifest(uid, title)
	data, err := json.Marshal(manifest)
	require.NoError(t, err)
	return data
}
