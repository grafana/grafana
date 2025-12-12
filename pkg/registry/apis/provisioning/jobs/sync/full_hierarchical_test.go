package sync

import (
	"context"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8testing "k8s.io/client-go/testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

/*
TestFullSync_HierarchicalErrorHandling tests the hierarchical error handling behavior:

FOLDER CREATION FAILURES:
- When a folder fails to be created with PathCreationError, all nested resources are skipped
- Nested resources are recorded with FileActionIgnored and error "skipped: parent folder creation failed"
- Only the folder creation error counts toward error limits
- Nested resource skips do NOT count toward error limits

FOLDER DELETION FAILURES:
- When a file deletion fails, it's tracked in failedDeletions
- When cleaning up folders, we check HasFailedDeletionsUnder()
- If children failed to delete, folder deletion is skipped with FileActionIgnored
- This prevents orphaning resources that still exist

DELETIONS NOT AFFECTED BY CREATION FAILURES:
- If a folder creation fails, deletion operations for resources in that folder still proceed
- This is because the resource might already exist from a previous sync
- Only creations/updates/renames are affected by failed folder creation

AUTOMATIC TRACKING:
- Record() automatically detects PathCreationError and adds to failedCreations
- Record() automatically detects deletion failures and adds to failedDeletions
- No manual calls to AddFailedCreation/AddFailedDeletion needed
*/
func TestFullSync_HierarchicalErrorHandling(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*repository.MockRepository, *resources.MockRepositoryResources, *resources.MockResourceClients, *jobs.MockJobProgressRecorder, *dynamicfake.FakeDynamicClient)
		changes       []ResourceFileChange
		description   string
		expectError   bool
		errorContains string
	}{
		{
			name:        "folder creation fails, nested file skipped",
			description: "When folder1/ fails to create, folder1/file.json should be skipped with FileActionIgnored",
			changes: []ResourceFileChange{
				{Path: "folder1/file.json", Action: repository.FileActionCreated},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, _ *dynamicfake.FakeDynamicClient) {
				// First, check if nested under failed creation - not yet
				progress.On("IsNestedUnderFailedCreation", "folder1/file.json").Return(false).Once()

				// WriteResourceFromFile fails with PathCreationError for folder1/
				folderErr := &resources.PathCreationError{Path: "folder1/", Err: fmt.Errorf("permission denied")}
				repoResources.On("WriteResourceFromFile", mock.Anything, "folder1/file.json", "").
					Return("", schema.GroupVersionKind{}, folderErr).Once()

				// File will be recorded with error, triggering automatic tracking of folder1/ failure
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/file.json" && r.Error != nil && r.Action == repository.FileActionCreated
				})).Return().Once()
			},
		},
		{
			name:        "folder creation fails, multiple nested resources skipped",
			description: "When folder1/ fails to create, all nested resources (subfolder, files) are skipped",
			changes: []ResourceFileChange{
				{Path: "folder1/file1.json", Action: repository.FileActionCreated},
				{Path: "folder1/subfolder/file2.json", Action: repository.FileActionCreated},
				{Path: "folder1/file3.json", Action: repository.FileActionCreated},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, _ *dynamicfake.FakeDynamicClient) {
				// First file triggers folder creation failure
				progress.On("IsNestedUnderFailedCreation", "folder1/file1.json").Return(false).Once()
				folderErr := &resources.PathCreationError{Path: "folder1/", Err: fmt.Errorf("permission denied")}
				repoResources.On("WriteResourceFromFile", mock.Anything, "folder1/file1.json", "").
					Return("", schema.GroupVersionKind{}, folderErr).Once()

				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/file1.json" && r.Error != nil
				})).Return().Once()

				// Subsequent files in same folder are skipped
				progress.On("IsNestedUnderFailedCreation", "folder1/subfolder/file2.json").Return(true).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/subfolder/file2.json" &&
						r.Action == repository.FileActionIgnored &&
						r.Error != nil &&
						r.Error.Error() == "skipped: parent folder creation failed"
				})).Return().Once()

				progress.On("IsNestedUnderFailedCreation", "folder1/file3.json").Return(true).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/file3.json" &&
						r.Action == repository.FileActionIgnored &&
						r.Error != nil &&
						r.Error.Error() == "skipped: parent folder creation failed"
				})).Return().Once()
			},
		},
		{
			name:        "file deletion failure tracked",
			description: "When a file deletion fails, it's automatically tracked in failedDeletions",
			changes: []ResourceFileChange{
				{
					Path:   "folder1/file.json",
					Action: repository.FileActionDeleted,
					Existing: &provisioning.ResourceListItem{
						Name:     "file1",
						Group:    "dashboard.grafana.app",
						Resource: "dashboards",
					},
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, dynamicClient *dynamicfake.FakeDynamicClient) {
				gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard", Version: "v1"}
				gvr := schema.GroupVersionResource{Group: "dashboard.grafana.app", Resource: "dashboards", Version: "v1"}

				clients.On("ForResource", mock.Anything, mock.MatchedBy(func(gvr schema.GroupVersionResource) bool {
					return gvr.Group == "dashboard.grafana.app"
				})).Return(dynamicClient.Resource(gvr), gvk, nil)

				// File deletion fails
				dynamicClient.PrependReactor("delete", "dashboards", func(action k8testing.Action) (bool, runtime.Object, error) {
					return true, nil, fmt.Errorf("permission denied")
				})

				// File deletion recorded with error, automatically tracked in failedDeletions
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/file.json" &&
						r.Action == repository.FileActionDeleted &&
						r.Error != nil
				})).Return().Once()
			},
		},
		{
			name:        "deletion proceeds despite creation failure",
			description: "When folder1/ fails to create, deletion of folder1/file2.json still proceeds (resource might exist from previous sync)",
			changes: []ResourceFileChange{
				{Path: "folder1/file1.json", Action: repository.FileActionCreated},
				{
					Path:   "folder1/file2.json",
					Action: repository.FileActionDeleted,
					Existing: &provisioning.ResourceListItem{
						Name:     "file2",
						Group:    "dashboard.grafana.app",
						Resource: "dashboards",
					},
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, dynamicClient *dynamicfake.FakeDynamicClient) {
				// Creation fails
				progress.On("IsNestedUnderFailedCreation", "folder1/file1.json").Return(false).Once()
				folderErr := &resources.PathCreationError{Path: "folder1/", Err: fmt.Errorf("permission denied")}
				repoResources.On("WriteResourceFromFile", mock.Anything, "folder1/file1.json", "").
					Return("", schema.GroupVersionKind{}, folderErr).Once()

				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/file1.json" && r.Error != nil
				})).Return().Once()

				// Deletion proceeds (NOT checking IsNestedUnderFailedCreation for deletions)
				// Note: deletion will fail because resource doesn't exist, but that's fine for this test
				gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard", Version: "v1"}
				gvr := schema.GroupVersionResource{Group: "dashboard.grafana.app", Resource: "dashboards", Version: "v1"}

				clients.On("ForResource", mock.Anything, mock.MatchedBy(func(gvr schema.GroupVersionResource) bool {
					return gvr.Group == "dashboard.grafana.app"
				})).Return(dynamicClient.Resource(gvr), gvk, nil)

				// Record deletion attempt (will have error since resource doesn't exist, but that's ok)
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "folder1/file2.json" &&
						r.Action == repository.FileActionDeleted
					// Not checking r.Error because resource doesn't exist in fake client
				})).Return().Once()
			},
		},
		{
			name:        "multi-level nesting - all skipped",
			description: "When level1/ fails, level1/level2/level3/file.json is also skipped",
			changes: []ResourceFileChange{
				{Path: "level1/file1.json", Action: repository.FileActionCreated},
				{Path: "level1/level2/file2.json", Action: repository.FileActionCreated},
				{Path: "level1/level2/level3/file3.json", Action: repository.FileActionCreated},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, _ *dynamicfake.FakeDynamicClient) {
				// First file triggers level1/ failure
				progress.On("IsNestedUnderFailedCreation", "level1/file1.json").Return(false).Once()
				folderErr := &resources.PathCreationError{Path: "level1/", Err: fmt.Errorf("permission denied")}
				repoResources.On("WriteResourceFromFile", mock.Anything, "level1/file1.json", "").
					Return("", schema.GroupVersionKind{}, folderErr).Once()

				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "level1/file1.json" && r.Error != nil
				})).Return().Once()

				// All nested files are skipped
				for _, path := range []string{"level1/level2/file2.json", "level1/level2/level3/file3.json"} {
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
			changes: []ResourceFileChange{
				{Path: "success/file1.json", Action: repository.FileActionCreated},
				{Path: "failure/file2.json", Action: repository.FileActionCreated},
				{Path: "failure/nested/file3.json", Action: repository.FileActionCreated},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, _ *dynamicfake.FakeDynamicClient) {
				// Success path works
				progress.On("IsNestedUnderFailedCreation", "success/file1.json").Return(false).Once()
				repoResources.On("WriteResourceFromFile", mock.Anything, "success/file1.json", "").
					Return("resource1", schema.GroupVersionKind{Kind: "Dashboard"}, nil).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "success/file1.json" && r.Error == nil
				})).Return().Once()

				// Failure path fails
				progress.On("IsNestedUnderFailedCreation", "failure/file2.json").Return(false).Once()
				folderErr := &resources.PathCreationError{Path: "failure/", Err: fmt.Errorf("disk full")}
				repoResources.On("WriteResourceFromFile", mock.Anything, "failure/file2.json", "").
					Return("", schema.GroupVersionKind{}, folderErr).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "failure/file2.json" && r.Error != nil
				})).Return().Once()

				// Nested file in failure path is skipped
				progress.On("IsNestedUnderFailedCreation", "failure/nested/file3.json").Return(true).Once()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Path == "failure/nested/file3.json" && r.Action == repository.FileActionIgnored
				})).Return().Once()
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := runtime.NewScheme()
			dynamicClient := dynamicfake.NewSimpleDynamicClient(scheme)

			repo := repository.NewMockRepository(t)
			repoResources := resources.NewMockRepositoryResources(t)
			clients := resources.NewMockResourceClients(t)
			progress := jobs.NewMockJobProgressRecorder(t)
			compareFn := NewMockCompareFn(t)

			repo.On("Config").Return(&provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
				Spec:       provisioning.RepositorySpec{Title: "Test Repo"},
			})

			tt.setupMocks(repo, repoResources, clients, progress, dynamicClient)

			compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(tt.changes, nil)
			progress.On("SetTotal", mock.Anything, len(tt.changes)).Return()
			progress.On("TooManyErrors").Return(nil).Maybe()

			err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))

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
		})
	}
}
