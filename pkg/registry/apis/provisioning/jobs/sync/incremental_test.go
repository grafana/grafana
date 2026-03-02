package sync

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

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

	err := IncrementalSync(ctx, repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t))
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

			err := IncrementalSync(context.Background(), repo, tt.previousRef, tt.currentRef, repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), tt.quotaTracker)

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

				// Mock HasDirPathFailedDeletion check for cleanup
				progress.On("HasDirPathFailedDeletion", "dashboards/").Return(false)

				// if the folder is not found in git, there should be a call to remove the folder from grafana
				repo.MockReader.On("Read", mock.Anything, "dashboards/", "").
					Return((*repository.FileInfo)(nil), repository.ErrFileNotFound)
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

				// Mock HasDirPathFailedDeletion check for cleanup
				progress.On("HasDirPathFailedDeletion", "dashboards/").Return(false)

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

				// Mock HasDirPathFailedDeletion checks for cleanup
				progress.On("HasDirPathFailedDeletion", "dashboards/").Return(false)
				progress.On("HasDirPathFailedDeletion", "alerts/").Return(false)

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

			err := IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), newPermissiveMockQuotaTracker(t))

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
