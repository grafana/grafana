package sync

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8testing "k8s.io/client-go/testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestFullSync_ContextCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
		},
	})

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]ResourceFileChange{{}}, nil, nil, nil)
	progress.On("SetTotal", mock.Anything, 1).Return()

	err := FullSync(ctx, repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotas.NewInMemoryQuotaTracker(0, 0), false)
	require.EqualError(t, err, "context canceled")
}

func TestFullSync_Error(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
	})

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, nil, nil, fmt.Errorf("some error"))

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotas.NewInMemoryQuotaTracker(0, 0), false)
	require.EqualError(t, err, "compare changes: some error")
}

func TestFullSync_NoChanges(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
	})

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]ResourceFileChange{}, nil, nil, nil)
	progress.On("SetFinalMessage", mock.Anything, "no changes to sync").Return()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotas.NewInMemoryQuotaTracker(0, 0), false)
	require.NoError(t, err)
}

func TestFullSync_SuccessfulFolderCreation(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Sync: provisioning.SyncOptions{
				Target: provisioning.SyncTargetTypeFolder,
			},
		},
	})

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]ResourceFileChange{}, nil, nil, nil)
	progress.On("SetFinalMessage", mock.Anything, "no changes to sync").Return()
	repoResources.On("EnsureFolderExists", mock.Anything, resources.Folder{
		ID:    "test-repo",
		Title: "Test Repo",
		Path:  "",
	}, "").Return(nil)

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotas.NewInMemoryQuotaTracker(0, 0), false)
	require.NoError(t, err)
}

func TestFullSync_FolderCreationFailed(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Sync: provisioning.SyncOptions{
				Target: provisioning.SyncTargetTypeFolder,
			},
		},
	})

	repoResources.On("EnsureFolderExists", mock.Anything, resources.Folder{
		ID:    "test-repo",
		Title: "Test Repo",
		Path:  "",
	}, "").Return(fmt.Errorf("folder creation failed"))

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotas.NewInMemoryQuotaTracker(0, 0), false)
	require.Error(t, err)
	require.Contains(t, err.Error(), "create root folder: folder creation failed")
}

func TestFullSync_FolderCreationFailedWithInstanceTarget(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Sync: provisioning.SyncOptions{
				Target: provisioning.SyncTargetTypeInstance,
			},
		},
	})

	// No folder creation should be attempted with instance target
	// But we should still test the error path for completeness
	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, nil, nil, fmt.Errorf("compare error"))

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotas.NewInMemoryQuotaTracker(0, 0), false)
	require.Error(t, err)
	require.Contains(t, err.Error(), "compare changes: compare error")
}

func TestFullSync_ApplyChanges(t *testing.T) { //nolint:gocyclo
	tests := []struct {
		name                  string
		setupMocks            func(*repository.MockRepository, *resources.MockRepositoryResources, *resources.MockResourceClients, *jobs.MockJobProgressRecorder, *MockCompareFn)
		verifyMocks           func(*testing.T, *resources.MockRepositoryResources)
		changes               []ResourceFileChange
		expectedError         string
		description           string
		folderMetadataEnabled bool
	}{
		{
			name:        "too many errors",
			description: "Should return an error when too many errors occur",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionCreated,
					Path:   "dashboards/one.json",
				},
				{
					Action: repository.FileActionCreated,
					Path:   "dashboards/two.json",
				},
				{
					Action: repository.FileActionCreated,
					Path:   "dashboards/three.json",
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				var callCount int64 = 0
				progress.On("TooManyErrors").Return(func() error {
					if atomic.AddInt64(&callCount, 1) > 1 {
						return fmt.Errorf("too many errors")
					}
					return nil
				})

				progress.On("HasDirPathFailedCreation", mock.MatchedBy(func(path string) bool {
					return path == "dashboards/one.json" || path == "dashboards/two.json" || path == "dashboards/three.json"
				})).Return(false).Maybe()

				repoResources.On("WriteResourceFromFile", mock.Anything, mock.MatchedBy(func(path string) bool {
					return path == "dashboards/one.json" || path == "dashboards/two.json" || path == "dashboards/three.json"
				}), "current-ref").Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil).Maybe()

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionCreated &&
						(result.Path() == "dashboards/one.json" || result.Path() == "dashboards/two.json" || result.Path() == "dashboards/three.json")
				})).Return().Maybe()
			},
			expectedError: "too many errors",
		},
		{
			name:        "successful apply with file creation",
			description: "Should successfully apply changes when creating a new file",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionCreated,
					Path:   "dashboards/test.json",
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("HasDirPathFailedCreation", "dashboards/test.json").Return(false)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "current-ref").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, jobs.NewGroupKindResult(
					"test-dashboard", "dashboards", "Dashboard").WithAction(repository.FileActionCreated).WithPath("dashboards/test.json").Build()).Return()
			},
		},
		{
			name:        "failed apply with file creation",
			description: "Should record an error when creating a new file",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionCreated,
					Path:   "dashboards/test.json",
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("HasDirPathFailedCreation", "dashboards/test.json").Return(false)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "current-ref").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, fmt.Errorf("write error"))

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionCreated &&
						result.Path() == "dashboards/test.json" &&
						result.Name() == "test-dashboard" &&
						result.Kind() == "Dashboard" &&
						result.Group() == "dashboards" &&
						result.Error() != nil &&
						result.Error().Error() == "writing resource from file dashboards/test.json: write error"
				})).Return()
			},
		},
		{
			name:        "successful apply with file update",
			description: "Should successfully apply changes when updating an existing file",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionUpdated,
					Path:   "dashboards/test.json",
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("HasDirPathFailedCreation", "dashboards/test.json").Return(false)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "current-ref").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, jobs.NewGroupKindResult(
					"test-dashboard",
					"dashboards",
					"Dashboard",
				).WithPath("dashboards/test.json").
					WithAction(repository.FileActionUpdated).
					Build()).Return()
			},
		},
		{
			name:        "failed apply with file update",
			description: "Should record an error when updating a file",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionUpdated,
					Path:   "dashboards/test.json",
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("HasDirPathFailedCreation", "dashboards/test.json").Return(false)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "current-ref").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, fmt.Errorf("write error"))

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionUpdated &&
						result.Path() == "dashboards/test.json" &&
						result.Name() == "test-dashboard" &&
						result.Kind() == "Dashboard" &&
						result.Group() == "dashboards" &&
						result.Error() != nil &&
						result.Error().Error() == "writing resource from file dashboards/test.json: write error"
				})).Return()
			},
		},
		{
			name:        "successful apply with folder creation",
			description: "Should successfully apply changes when creating a new folder",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionCreated,
					Path:   "one/two/three/",
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("HasDirPathFailedCreation", "one/two/three/").Return(false)

				repoResources.On("EnsureFolderPathExist", mock.Anything, "one/two/three/", "current-ref").Return("some-folder", nil)
				progress.On("Record", mock.Anything, jobs.NewGroupKindResult(
					"some-folder",
					"folder.grafana.app",
					"Folder",
				).WithPath("one/two/three/").
					WithAction(repository.FileActionCreated).
					Build()).Return()
			},
		},
		{
			name:        "failed apply folder creation",
			description: "Should record an error when creating a new folder",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionCreated,
					Path:   "one/two/three/",
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("HasDirPathFailedCreation", "one/two/three/").Return(false)

				repoResources.On(
					"EnsureFolderPathExist",
					mock.Anything,
					"one/two/three/",
					"current-ref",
				).Return("some-folder", errors.New("folder creation error"))
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionCreated &&
						result.Path() == "one/two/three/" &&
						result.Name() == "" &&
						result.Kind() == "Folder" &&
						result.Group() == "folder.grafana.app" &&
						result.Error() != nil &&
						result.Error().Error() == "ensuring folder exists at path one/two/three/: folder creation error"
				})).Return()
			},
		},
		{
			name:        "successful apply with file deletion",
			description: "Should successfully apply changes when deleting an existing file",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionDeleted,
					Path:   "dashboards/test.json",
					Existing: &provisioning.ResourceListItem{
						Name:     "test-dashboard",
						Resource: "dashboards",
						Group:    "dashboards",
					},
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)

				scheme := runtime.NewScheme()
				require.NoError(t, metav1.AddMetaToScheme(scheme))
				listGVK := schema.GroupVersionKind{
					Group:   resources.DashboardResource.Group,
					Version: resources.DashboardResource.Version,
					Kind:    "DashboardList",
				}

				scheme.AddKnownTypeWithName(listGVK, &metav1.PartialObjectMetadataList{})
				scheme.AddKnownTypeWithName(schema.GroupVersionKind{
					Group:   resources.DashboardResource.Group,
					Version: resources.DashboardResource.Version,
					Kind:    resources.DashboardResource.Resource,
				}, &metav1.PartialObjectMetadata{})

				fakeDynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
					resources.DashboardResource: listGVK.Kind,
				})

				fakeDynamicClient.PrependReactor("delete", "dashboards", func(action k8testing.Action) (bool, runtime.Object, error) {
					return true, nil, nil
				})

				clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
					Group:    "dashboards",
					Resource: "dashboards",
				}).Return(fakeDynamicClient.Resource(resources.DashboardResource), schema.GroupVersionKind{
					Kind:    "Dashboard",
					Group:   "dashboards",
					Version: "v1",
				}, nil)

				progress.On("Record", mock.Anything, jobs.NewGroupKindResult(
					"test-dashboard",
					"dashboards",
					"Dashboard",
				).WithPath("dashboards/test.json").
					WithAction(repository.FileActionDeleted).
					Build()).Return()
			},
		},
		{
			name:        "file delete error",
			description: "Should return an error when deleting a file",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionDeleted,
					Path:   "dashboards/test.json",
					Existing: &provisioning.ResourceListItem{
						Name:     "test-dashboard",
						Resource: "dashboards",
						Group:    "dashboards",
					},
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)

				scheme := runtime.NewScheme()
				require.NoError(t, metav1.AddMetaToScheme(scheme))
				listGVK := schema.GroupVersionKind{
					Group:   resources.DashboardResource.Group,
					Version: resources.DashboardResource.Version,
					Kind:    "DashboardList",
				}

				scheme.AddKnownTypeWithName(listGVK, &metav1.PartialObjectMetadataList{})
				scheme.AddKnownTypeWithName(schema.GroupVersionKind{
					Group:   resources.DashboardResource.Group,
					Version: resources.DashboardResource.Version,
					Kind:    resources.DashboardResource.Resource,
				}, &metav1.PartialObjectMetadata{})

				fakeDynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
					resources.DashboardResource: listGVK.Kind,
				})

				fakeDynamicClient.PrependReactor("delete", "dashboards", func(action k8testing.Action) (bool, runtime.Object, error) {
					return true, nil, fmt.Errorf("delete failed")
				})

				clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
					Group:    "dashboards",
					Resource: "dashboards",
				}).Return(fakeDynamicClient.Resource(resources.DashboardResource), schema.GroupVersionKind{
					Kind:    "Dashboard",
					Group:   "dashboards",
					Version: "v1",
				}, nil)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionDeleted &&
						result.Path() == "dashboards/test.json" &&
						result.Name() == "test-dashboard" &&
						result.Kind() == "Dashboard" &&
						result.Group() == "dashboards" &&
						result.Error() != nil &&
						result.Error().Error() == "deleting resource dashboards/Dashboard test-dashboard: delete failed"
				})).Return()
			},
		},
		{
			name:        "without existing for delete",
			description: "Should record an error when deleting a file",
			changes: []ResourceFileChange{
				{
					Action:   repository.FileActionDeleted,
					Path:     "dashboards/test.json",
					Existing: nil,
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionDeleted &&
						result.Path() == "dashboards/test.json" &&
						result.Error() != nil &&
						result.Error().Error() == "processing deletion for file dashboards/test.json: missing existing reference"
				})).Return()
			},
		},
		{
			name:        "without existing name for delete",
			description: "Should record an error when deleting a file",
			changes: []ResourceFileChange{
				{
					Action:   repository.FileActionDeleted,
					Path:     "dashboards/test.json",
					Existing: &provisioning.ResourceListItem{},
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionDeleted &&
						result.Path() == "dashboards/test.json" &&
						result.Error() != nil &&
						result.Error().Error() == "processing deletion for file dashboards/test.json: missing existing reference"
				})).Return()
			},
		},
		{
			name:        "error finding client for delete",
			description: "Should record an error when deleting a file",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionDeleted,
					Path:   "dashboards/test.json",
					Existing: &provisioning.ResourceListItem{
						Name:     "test-dashboard",
						Group:    "dashboards",
						Resource: "dashboards",
					},
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)

				clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
					Group:    "dashboards",
					Resource: "dashboards",
				}).Return(nil, schema.GroupVersionKind{}, errors.New("didn't work"))

				progress.On("Record", mock.Anything, jobs.NewGroupKindResult(
					"test-dashboard",
					"dashboards",
					"dashboards", // could not find a real kind
				).WithPath("dashboards/test.json").
					WithAction(repository.FileActionDeleted).
					WithError(fmt.Errorf("get client for deleted object: %w", errors.New("didn't work"))).
					Build()).Return()
			},
		},
		{
			name:                  "successful apply with folder deletion",
			description:           "Should successfully apply changes when deleting an existing folder",
			folderMetadataEnabled: true,
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionDeleted,
					Path:   "to-be-deleted/",
					Existing: &provisioning.ResourceListItem{
						Name:     "test-folder",
						Resource: "Folder",
						Group:    "folders",
					},
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("HasDirPathFailedDeletion", "to-be-deleted/").Return(false)

				scheme := runtime.NewScheme()
				require.NoError(t, metav1.AddMetaToScheme(scheme))
				listGVK := schema.GroupVersionKind{
					Group:   resources.FolderResource.Group,
					Version: resources.FolderResource.Version,
					Kind:    "FolderList",
				}

				scheme.AddKnownTypeWithName(listGVK, &metav1.PartialObjectMetadataList{})
				scheme.AddKnownTypeWithName(schema.GroupVersionKind{
					Group:   resources.FolderResource.Group,
					Version: resources.FolderResource.Version,
					Kind:    resources.FolderResource.Resource,
				}, &metav1.PartialObjectMetadata{})

				fakeDynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
					resources.FolderResource: listGVK.Kind,
				})

				fakeDynamicClient.PrependReactor("delete", "folders", func(action k8testing.Action) (bool, runtime.Object, error) {
					return true, nil, nil
				})

				clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
					Group:    "folders",
					Resource: "Folder",
				}).Return(fakeDynamicClient.Resource(resources.FolderResource), schema.GroupVersionKind{
					Kind:    "Folder",
					Group:   "folders",
					Version: "v1",
				}, nil)

				repoResources.On("RemoveFolderFromTree", "test-folder").Return()

				progress.On("Record", mock.Anything, jobs.NewGroupKindResult(
					"test-folder",
					"folders",
					"Folder",
				).WithPath("to-be-deleted/").
					WithAction(repository.FileActionDeleted).
					Build()).Return()
			},
		},
		{
			name:        "successful apply with folder deletion and metadata disabled",
			description: "Should not remove the deleted folder from the in-memory tree when folder metadata is disabled",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionDeleted,
					Path:   "to-be-deleted/",
					Existing: &provisioning.ResourceListItem{
						Name:     "test-folder",
						Resource: "Folder",
						Group:    "folders",
					},
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("HasDirPathFailedDeletion", "to-be-deleted/").Return(false)

				scheme := runtime.NewScheme()
				require.NoError(t, metav1.AddMetaToScheme(scheme))
				listGVK := schema.GroupVersionKind{
					Group:   resources.FolderResource.Group,
					Version: resources.FolderResource.Version,
					Kind:    "FolderList",
				}

				scheme.AddKnownTypeWithName(listGVK, &metav1.PartialObjectMetadataList{})
				scheme.AddKnownTypeWithName(schema.GroupVersionKind{
					Group:   resources.FolderResource.Group,
					Version: resources.FolderResource.Version,
					Kind:    resources.FolderResource.Resource,
				}, &metav1.PartialObjectMetadata{})

				fakeDynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
					resources.FolderResource: listGVK.Kind,
				})

				fakeDynamicClient.PrependReactor("delete", "folders", func(action k8testing.Action) (bool, runtime.Object, error) {
					return true, nil, nil
				})

				clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
					Group:    "folders",
					Resource: "Folder",
				}).Return(fakeDynamicClient.Resource(resources.FolderResource), schema.GroupVersionKind{
					Kind:    "Folder",
					Group:   "folders",
					Version: "v1",
				}, nil)

				progress.On("Record", mock.Anything, jobs.NewGroupKindResult(
					"test-folder",
					"folders",
					"Folder",
				).WithPath("to-be-deleted/").
					WithAction(repository.FileActionDeleted).
					Build()).Return()
			},
			verifyMocks: func(t *testing.T, repoResources *resources.MockRepositoryResources) {
				repoResources.AssertNotCalled(t, "RemoveFolderFromTree", "test-folder")
			},
		},
		{
			name:                  "failed to apply with folder deletion",
			description:           "Should record an error when deleting a folder",
			folderMetadataEnabled: true,
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionDeleted,
					Path:   "to-be-deleted/",
					Existing: &provisioning.ResourceListItem{
						Name:     "test-folder",
						Resource: "Folder",
						Group:    "folders",
					},
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("HasDirPathFailedDeletion", "to-be-deleted/").Return(false)

				scheme := runtime.NewScheme()
				require.NoError(t, metav1.AddMetaToScheme(scheme))
				listGVK := schema.GroupVersionKind{
					Group:   resources.FolderResource.Group,
					Version: resources.FolderResource.Version,
					Kind:    "FolderList",
				}

				scheme.AddKnownTypeWithName(listGVK, &metav1.PartialObjectMetadataList{})
				scheme.AddKnownTypeWithName(schema.GroupVersionKind{
					Group:   resources.FolderResource.Group,
					Version: resources.FolderResource.Version,
					Kind:    resources.FolderResource.Resource,
				}, &metav1.PartialObjectMetadata{})

				fakeDynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
					resources.FolderResource: listGVK.Kind,
				})

				fakeDynamicClient.PrependReactor("delete", "folders", func(action k8testing.Action) (bool, runtime.Object, error) {
					return true, nil, fmt.Errorf("delete failed")
				})

				clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
					Group:    "folders",
					Resource: "Folder",
				}).Return(fakeDynamicClient.Resource(resources.FolderResource), schema.GroupVersionKind{
					Kind:    "Folder",
					Group:   "folders",
					Version: "v1",
				}, nil)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionDeleted &&
						result.Path() == "to-be-deleted/" &&
						result.Name() == "test-folder" &&
						result.Kind() == "Folder" &&
						result.Group() == "folders" &&
						result.Error() != nil &&
						result.Error().Error() == "deleting resource folders/Folder test-folder: delete failed"
				})).Return()
			},
			verifyMocks: func(t *testing.T, repoResources *resources.MockRepositoryResources) {
				repoResources.AssertNotCalled(t, "RemoveFolderFromTree", "test-folder")
			},
		},
		{
			name:        "operation timeout after 15 seconds",
			description: "Should record timeout error when operation takes longer than 15 seconds",
			changes: []ResourceFileChange{
				{
					Action: repository.FileActionCreated,
					Path:   "dashboards/slow.json",
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)
				progress.On("HasDirPathFailedCreation", "dashboards/slow.json").Return(false)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/slow.json", "current-ref").
					Run(func(args mock.Arguments) {
						ctx := args.Get(0).(context.Context)
						select {
						case <-ctx.Done():
							return
						case <-time.After(20 * time.Second):
							return
						}
					}).
					Return("", schema.GroupVersionKind{}, context.DeadlineExceeded)

				// applyChange records the error from WriteResourceFromFile
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action() == repository.FileActionCreated &&
						result.Path() == "dashboards/slow.json" &&
						result.Error() != nil &&
						result.Error().Error() == "writing resource from file dashboards/slow.json: context deadline exceeded"
				})).Return().Once()
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockRepository(t)
			repoResources := resources.NewMockRepositoryResources(t)
			clients := resources.NewMockResourceClients(t)
			progress := jobs.NewMockJobProgressRecorder(t)
			compareFn := NewMockCompareFn(t)

			tt.setupMocks(repo, repoResources, clients, progress, compareFn)
			compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(tt.changes, nil, nil, nil)
			repo.On("Config").Return(&provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
				},
			})

			progress.On("SetTotal", mock.Anything, len(tt.changes)).Return()
			err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotas.NewInMemoryQuotaTracker(0, 0), tt.folderMetadataEnabled)
			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError, tt.description)
			} else {
				require.NoError(t, err, tt.description)
			}
			if tt.verifyMocks != nil {
				tt.verifyMocks(t, repoResources)
			}
		})
	}
}

func createdChanges(n int) []ResourceFileChange {
	changes := make([]ResourceFileChange, n)
	for i := range changes {
		changes[i] = ResourceFileChange{
			Path:   fmt.Sprintf("file-%d.json", i),
			Action: repository.FileActionCreated,
		}
	}
	return changes
}

func deletedChanges(n int) []ResourceFileChange {
	changes := make([]ResourceFileChange, n)
	for i := range changes {
		changes[i] = ResourceFileChange{
			Path:   fmt.Sprintf("file-%d.json", i),
			Action: repository.FileActionDeleted,
		}
	}
	return changes
}

func TestCheckQuotaBeforeSync(t *testing.T) {
	tracer := tracing.NewNoopTracerService()

	tests := []struct {
		name      string
		changes   []ResourceFileChange
		config    *provisioning.Repository
		expectErr bool
	}{
		{
			name:    "no resource quota condition - proceeds",
			changes: createdChanges(10),
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{},
				},
			},
			expectErr: false,
		},
		{
			name:    "resource quota condition with status True - proceeds",
			changes: createdChanges(10),
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionTrue,
							Reason: "WithinLimit",
						},
					},
				},
			},
			expectErr: false,
		},
		{
			name:    "resource quota exceeded but quota limit is zero (unlimited) - proceeds",
			changes: createdChanges(10),
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 0,
					},
				},
			},
			expectErr: false,
		},
		{
			name:    "final count within quota - proceeds",
			changes: createdChanges(5),
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
					Stats: []provisioning.ResourceCount{
						{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 50},
						{Group: "alerting.grafana.app", Resource: "rules", Count: 40},
					},
				},
			},
			expectErr: false,
		},
		{
			name:    "final count exactly at quota limit - proceeds",
			changes: createdChanges(10),
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
					Stats: []provisioning.ResourceCount{
						{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 90},
					},
				},
			},
			expectErr: false,
		},
		{
			name:    "final count exceeds quota - returns QuotaExceededError",
			changes: createdChanges(20),
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
					Stats: []provisioning.ResourceCount{
						{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 90},
					},
				},
			},
			expectErr: true,
		},
		{
			name:    "negative net change brings count below quota - proceeds",
			changes: deletedChanges(10),
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
					Stats: []provisioning.ResourceCount{
						{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 110},
					},
				},
			},
			expectErr: false,
		},
		{
			name:    "delete-only pull still over quota - proceeds since all changes are deletions",
			changes: deletedChanges(5),
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
					Stats: []provisioning.ResourceCount{
						{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 120},
					},
				},
			},
			expectErr: false,
		},
		{
			name:    "mixed deletions and creations with net negative changes - blocked",
			changes: append(deletedChanges(10), createdChanges(3)...),
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
					Stats: []provisioning.ResourceCount{
						{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 110},
					},
				},
			},
			expectErr: true,
		},
		{
			name:    "multiple resource types - counts summed exceeds quota",
			changes: createdChanges(5),
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
					Stats: []provisioning.ResourceCount{
						{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 40},
						{Group: "folders.grafana.app", Resource: "folders", Count: 56},
					},
				},
			},
			expectErr: true,
		},
		{
			name:    "condition reason is not QuotaExceeded - proceeds",
			changes: createdChanges(1000),
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: "SomeOtherReason",
						},
					},
				},
			},
			expectErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockConfigRepository(t)
			repo.EXPECT().Config().Return(tt.config)

			err := checkQuotaBeforeSync(context.Background(), repo, tt.changes, tracer)
			if tt.expectErr {
				var quotaErr *quotas.QuotaExceededError
				require.ErrorAs(t, err, &quotaErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestFullSync_QuotaTrackerSkipsCreationsAtLimit(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		Spec:       provisioning.RepositorySpec{Title: "Test Repo"},
	})

	changes := []ResourceFileChange{
		{Action: repository.FileActionCreated, Path: "dashboards/a.json"},
		{Action: repository.FileActionCreated, Path: "dashboards/b.json"},
		{Action: repository.FileActionCreated, Path: "dashboards/c.json"},
	}

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changes, nil, nil, nil)
	progress.On("SetTotal", mock.Anything, 3).Return()
	progress.On("TooManyErrors").Return(nil)

	// First file: allowed, write succeeds
	progress.On("HasDirPathFailedCreation", "dashboards/a.json").Return(false)
	repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/a.json", "ref").
		Return("dash-a", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "dashboards/a.json" && r.Action() == repository.FileActionCreated && r.Error() == nil
	})).Return().Once()

	// Second and third files: quota exceeded, skipped
	progress.On("HasDirPathFailedCreation", "dashboards/b.json").Return(false).Maybe()
	progress.On("HasDirPathFailedCreation", "dashboards/c.json").Return(false).Maybe()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return (r.Path() == "dashboards/b.json" || r.Path() == "dashboards/c.json") &&
			r.Warning() != nil && r.Error() == nil
	})).Return().Maybe()

	// Tracker: 9 out of 10, so only 1 creation allowed
	tracker := quotas.NewInMemoryQuotaTracker(9, 10)

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 1, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), tracker, false)
	require.NoError(t, err)

	// WriteResourceFromFile should have been called only once (for "a.json")
	repoResources.AssertNumberOfCalls(t, "WriteResourceFromFile", 1)
}

func TestFullSync_QuotaTrackerAllowsUpdatesRegardlessOfQuota(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		Spec:       provisioning.RepositorySpec{Title: "Test Repo"},
	})

	changes := []ResourceFileChange{
		{Action: repository.FileActionUpdated, Path: "dashboards/existing.json"},
	}

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changes, nil, nil, nil)
	progress.On("SetTotal", mock.Anything, 1).Return()
	progress.On("TooManyErrors").Return(nil)
	progress.On("HasDirPathFailedCreation", "dashboards/existing.json").Return(false)

	repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/existing.json", "ref").
		Return("dash-existing", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "dashboards/existing.json" && r.Action() == repository.FileActionUpdated && r.Error() == nil
	})).Return()

	// Tracker already at limit — but updates should still proceed
	tracker := quotas.NewInMemoryQuotaTracker(10, 10)

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 1, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), tracker, false)
	require.NoError(t, err)

	repoResources.AssertCalled(t, "WriteResourceFromFile", mock.Anything, "dashboards/existing.json", "ref")
}

func TestFullSync_MissingFolderMetadata_FlagEnabled(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
	})

	// A real change so FullSync doesn't exit early, with a folder that has a matching change
	changes := []ResourceFileChange{
		{Action: repository.FileActionCreated, Path: "myfolder/"},
		{Action: repository.FileActionCreated, Path: "myfolder/dashboard.json"},
	}
	// Compare returns the missing folder metadata list directly
	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(changes, []string{"myfolder/"}, nil, nil)

	// Expect a warning record for the missing folder metadata with action derived from changes
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "myfolder/" &&
			r.Action() == repository.FileActionCreated &&
			r.Warning() != nil
	})).Return()

	progress.On("SetTotal", mock.Anything, 2).Return()
	progress.On("TooManyErrors").Return(nil)
	progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)

	repoResources.On("EnsureFolderPathExist", mock.Anything, "myfolder/", "ref").
		Return("myfolder-uid", nil)
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "myfolder/" && r.Warning() == nil
	})).Return()

	repoResources.On("WriteResourceFromFile", mock.Anything, "myfolder/dashboard.json", "ref").
		Return("dash1", schema.GroupVersionKind{Kind: "Dashboard"}, nil)
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "myfolder/dashboard.json"
	})).Return()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 1, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotas.NewInMemoryQuotaTracker(0, 0), true)
	require.NoError(t, err)
}

func TestFullSync_MissingFolderMetadata_FlagDisabled(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
	})

	changes := []ResourceFileChange{
		{Action: repository.FileActionCreated, Path: "myfolder/dashboard.json"},
	}
	// Compare always returns missing list, even when flag is disabled
	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(changes, []string{"myfolder/"}, nil, nil)

	progress.On("SetTotal", mock.Anything, 1).Return()
	progress.On("TooManyErrors").Return(nil)
	progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)

	repoResources.On("WriteResourceFromFile", mock.Anything, "myfolder/dashboard.json", "ref").
		Return("dash1", schema.GroupVersionKind{Kind: "Dashboard"}, nil)
	// Only expect Record for the dashboard write, NOT for folder metadata warning
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "myfolder/dashboard.json"
	})).Return()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 1, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotas.NewInMemoryQuotaTracker(0, 0), false)
	require.NoError(t, err)
}

func TestFullSync_InvalidFolderMetadataWarning(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
	})

	invalidWarning := resources.NewInvalidFolderMetadata("myfolder/", errors.New("missing metadata.name"))
	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return([]ResourceFileChange{}, nil, []*resources.InvalidFolderMetadata{invalidWarning}, nil)

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "myfolder/" &&
			r.Action() == repository.FileActionIgnored &&
			r.Warning() != nil &&
			errors.Is(r.Warning(), resources.ErrInvalidFolderMetadata)
	})).Return()
	progress.On("SetFinalMessage", mock.Anything, "no changes to sync").Return()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 1, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotas.NewInMemoryQuotaTracker(0, 0), true)
	require.NoError(t, err)
}

func TestFullSync_InvalidFolderMetadataWarning_ActionAware(t *testing.T) {
	tests := []struct {
		name         string
		action       repository.FileAction
		resultAction repository.FileAction
	}{
		{
			name:         "created folder metadata keeps created action",
			action:       repository.FileActionCreated,
			resultAction: repository.FileActionCreated,
		},
		{
			name:         "updated folder metadata keeps updated action",
			action:       repository.FileActionUpdated,
			resultAction: repository.FileActionUpdated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockRepository(t)
			repoResources := resources.NewMockRepositoryResources(t)
			clients := resources.NewMockResourceClients(t)
			progress := jobs.NewMockJobProgressRecorder(t)
			compareFn := NewMockCompareFn(t)

			repo.On("Config").Return(&provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
			})

			invalidWarning := resources.NewInvalidFolderMetadata("myfolder/", errors.New("missing metadata.name")).WithAction(tt.action)
			compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Return([]ResourceFileChange{}, nil, []*resources.InvalidFolderMetadata{invalidWarning}, nil)

			progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
				return r.Path() == "myfolder/" &&
					r.Action() == tt.resultAction &&
					r.Warning() != nil &&
					errors.Is(r.Warning(), resources.ErrInvalidFolderMetadata)
			})).Return()
			progress.On("SetFinalMessage", mock.Anything, "no changes to sync").Return()

			err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 1, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotas.NewInMemoryQuotaTracker(0, 0), true)
			require.NoError(t, err)
		})
	}
}

func TestApplyChanges_DefersOldFolderDeletion(t *testing.T) {
	// Verify that old folder UIDs are deleted AFTER folder creations and file creations.
	// The ordering must be: folder phase -> file phase -> old folder deletion.
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	tracer := tracing.NewNoopTracerService()
	metrics := jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry())

	// Track call ordering. With maxSyncWorkers=1 all phases are sequential,
	// so no mutex is needed.
	var callOrder []string
	recordCall := func(name string) {
		callOrder = append(callOrder, name)
	}

	changes := []ResourceFileChange{
		{
			// Folder creation with OldFolderUID — triggers deferred deletion
			Action:        repository.FileActionUpdated,
			Path:          "myfolder/",
			FolderRenamed: true,
			Existing:      &provisioning.ResourceListItem{Name: "old-uid-123"},
		},
		{
			// A file creation that needs to happen before old folder cleanup
			Action: repository.FileActionCreated,
			Path:   "myfolder/dashboard.json",
		},
	}

	progress.On("SetTotal", mock.Anything, 2).Return()
	progress.On("TooManyErrors").Return(nil)
	progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
	progress.On("HasChildPathFailedUpdate", mock.Anything).Return(false)

	// Folder phase: updated folder passes ForceWalk + relocating UID via variadic opts
	repoResources.On("EnsureFolderPathExist", mock.Anything, "myfolder/", "test-ref", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
		recordCall("EnsureFolderPathExist")
	}).Return("new-uid-456", nil)

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "myfolder/" && r.Action() == repository.FileActionUpdated
	})).Return()

	// File phase: dashboard creation
	repoResources.On("WriteResourceFromFile", mock.Anything, "myfolder/dashboard.json", "test-ref").Run(func(args mock.Arguments) {
		recordCall("WriteResourceFromFile")
	}).Return("dash-1", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "myfolder/dashboard.json"
	})).Return()

	// Old folder deletion phase
	repoResources.On("RemoveFolder", mock.Anything, "old-uid-123").Run(func(args mock.Arguments) {
		recordCall("RemoveFolder")
	}).Return(nil)

	// Successful old folder deletion also records progress
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "myfolder/" &&
			r.Action() == repository.FileActionDeleted &&
			r.Name() == "old-uid-123" &&
			r.Error() == nil
	})).Return()

	err := applyChanges(
		context.Background(), changes, clients, "test-ref", repoResources, progress, tracer, 1, metrics,
		quotas.NewInMemoryQuotaTracker(0, 0), true,
	)
	require.NoError(t, err)

	// Verify ordering: folder phase -> file phase -> old folder deletion
	require.Equal(t, []string{
		"EnsureFolderPathExist", // folder phase: create/update folder (with relocating UID)
		"WriteResourceFromFile", // file phase: create dashboard
		"RemoveFolder",          // deferred: delete old folder after re-parenting
	}, callOrder)
}

func TestApplyChanges_SortsFolderUpdatesShallowestFirst(t *testing.T) {
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	tracer := tracing.NewNoopTracerService()
	metrics := jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry())

	var callOrder []string
	recordCall := func(name string) {
		callOrder = append(callOrder, name)
	}

	changes := []ResourceFileChange{
		{
			Action:   repository.FileActionUpdated,
			Path:     "parent/child/",
			Existing: &provisioning.ResourceListItem{Name: "child-uid"},
		},
		{
			Action:   repository.FileActionUpdated,
			Path:     "parent/",
			Existing: &provisioning.ResourceListItem{Name: "parent-uid"},
		},
	}

	progress.On("SetTotal", mock.Anything, 2).Return()
	progress.On("TooManyErrors").Return(nil)
	progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Action() == repository.FileActionUpdated &&
			(r.Path() == "parent/" || r.Path() == "parent/child/")
	})).Return()

	repoResources.On("EnsureFolderPathExist", mock.Anything, "parent/", "test-ref", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
		recordCall("ensure parent")
	}).Return("parent-uid", nil)

	repoResources.On("EnsureFolderPathExist", mock.Anything, "parent/child/", "test-ref", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
		recordCall("ensure child")
	}).Return("child-uid", nil)

	err := applyChanges(
		context.Background(), changes, clients, "test-ref", repoResources, progress, tracer, 1, metrics,
		quotas.NewInMemoryQuotaTracker(0, 0), true,
	)
	require.NoError(t, err)
	require.Equal(t, []string{
		"ensure parent",
		"ensure child",
	}, callOrder)
}

func TestApplyChanges_OldFolderDeletion_DeepestFirst(t *testing.T) {
	// When multiple folders have OldFolderUID, deeper paths must be deleted first.
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	tracer := tracing.NewNoopTracerService()
	metrics := jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry())

	// Track deletion order. Old folder deletion is sequential, so no mutex needed.
	var deletionOrder []string

	changes := []ResourceFileChange{
		{
			Action:        repository.FileActionUpdated,
			Path:          "parent/",
			FolderRenamed: true,
			Existing:      &provisioning.ResourceListItem{Name: "old-parent-uid"},
		},
		{
			Action:        repository.FileActionUpdated,
			Path:          "parent/child/",
			FolderRenamed: true,
			Existing:      &provisioning.ResourceListItem{Name: "old-child-uid"},
		},
	}

	progress.On("SetTotal", mock.Anything, 2).Return()
	progress.On("TooManyErrors").Return(nil)
	progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
	progress.On("HasChildPathFailedUpdate", mock.Anything).Return(false)

	// Folder phase mocks (ForceWalk + relocating UID passed via variadic opts)
	repoResources.On("EnsureFolderPathExist", mock.Anything, mock.Anything, "test-ref", mock.Anything, mock.Anything).Return("new-uid", nil)
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Action() == repository.FileActionUpdated
	})).Return()

	// Old folder deletion mocks — record the order
	repoResources.On("RemoveFolder", mock.Anything, mock.MatchedBy(func(uid string) bool {
		return uid == "old-parent-uid" || uid == "old-child-uid"
	})).Run(func(args mock.Arguments) {
		deletionOrder = append(deletionOrder, args.Get(1).(string))
	}).Return(nil)

	// Successful old folder deletions also record progress
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Action() == repository.FileActionDeleted && r.Error() == nil
	})).Return()

	err := applyChanges(
		context.Background(), changes, clients, "test-ref", repoResources, progress, tracer, 1, metrics,
		quotas.NewInMemoryQuotaTracker(0, 0), true,
	)
	require.NoError(t, err)

	// Deeper path ("parent/child/") must be deleted before shallower ("parent/")
	require.Equal(t, []string{"old-child-uid", "old-parent-uid"}, deletionOrder)
}

func TestApplyChanges_OldFolderDeletion_ErrorContinues(t *testing.T) {
	// When RemoveFolder fails, the error is recorded in progress but applyChanges does NOT fail.
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	tracer := tracing.NewNoopTracerService()
	metrics := jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry())

	changes := []ResourceFileChange{
		{
			Action:        repository.FileActionUpdated,
			Path:          "broken/",
			FolderRenamed: true,
			Existing:      &provisioning.ResourceListItem{Name: "old-broken-uid"},
		},
	}

	progress.On("SetTotal", mock.Anything, 1).Return()
	progress.On("TooManyErrors").Return(nil)
	progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
	progress.On("HasChildPathFailedUpdate", mock.Anything).Return(false)

	// Folder phase (ForceWalk + relocating UID passed via variadic opts)
	repoResources.On("EnsureFolderPathExist", mock.Anything, "broken/", "test-ref", mock.Anything, mock.Anything).Return("new-broken-uid", nil)
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "broken/" && r.Action() == repository.FileActionUpdated && r.Error() == nil
	})).Return()

	// RemoveFolder fails
	repoResources.On("RemoveFolder", mock.Anything, "old-broken-uid").Return(errors.New("folder in use"))

	// Expect progress records the error for the old folder deletion
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path() == "broken/" &&
			r.Action() == repository.FileActionDeleted &&
			r.Name() == "old-broken-uid" &&
			r.Error() != nil &&
			r.Error().Error() == "delete old folder old-broken-uid after UID change: folder in use"
	})).Return()

	err := applyChanges(
		context.Background(), changes, clients, "test-ref", repoResources, progress, tracer, 1, metrics,
		quotas.NewInMemoryQuotaTracker(0, 0), true,
	)

	// applyChanges must NOT return an error even though RemoveFolder failed
	require.NoError(t, err)

	// Verify RemoveFolder was actually called
	repoResources.AssertCalled(t, "RemoveFolder", mock.Anything, "old-broken-uid")
}
