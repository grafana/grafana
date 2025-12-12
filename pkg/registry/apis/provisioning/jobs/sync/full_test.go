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

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]ResourceFileChange{{}}, nil)
	progress.On("SetTotal", mock.Anything, 1).Return()

	err := FullSync(ctx, repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
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

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, fmt.Errorf("some error"))

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
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

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]ResourceFileChange{}, nil)
	progress.On("SetFinalMessage", mock.Anything, "no changes to sync").Return()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
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

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]ResourceFileChange{}, nil)
	progress.On("SetFinalMessage", mock.Anything, "no changes to sync").Return()
	repoResources.On("EnsureFolderExists", mock.Anything, resources.Folder{
		ID:    "test-repo",
		Title: "Test Repo",
		Path:  "",
	}, "").Return(nil)

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
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

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
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
	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, fmt.Errorf("compare error"))

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
	require.Error(t, err)
	require.Contains(t, err.Error(), "compare changes: compare error")
}

func TestFullSync_ApplyChanges(t *testing.T) { //nolint:gocyclo
	tests := []struct {
		name          string
		setupMocks    func(*repository.MockRepository, *resources.MockRepositoryResources, *resources.MockResourceClients, *jobs.MockJobProgressRecorder, *MockCompareFn)
		changes       []ResourceFileChange
		expectedError string
		description   string
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

				repoResources.On("WriteResourceFromFile", mock.Anything, mock.MatchedBy(func(path string) bool {
					return path == "dashboards/one.json" || path == "dashboards/two.json" || path == "dashboards/three.json"
				}), "").Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil).Maybe()

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action == repository.FileActionCreated &&
						(result.Path == "dashboards/one.json" || result.Path == "dashboards/two.json" || result.Path == "dashboards/three.json")
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

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action: repository.FileActionCreated,
					Path:   "dashboards/test.json",
					Name:   "test-dashboard",
					Kind:   "Dashboard",
					Group:  "dashboards",
				}).Return()
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

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, fmt.Errorf("write error"))

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action == repository.FileActionCreated &&
						result.Path == "dashboards/test.json" &&
						result.Name == "test-dashboard" &&
						result.Kind == "Dashboard" &&
						result.Group == "dashboards" &&
						result.Error != nil &&
						result.Error.Error() == "writing resource from file dashboards/test.json: write error"
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

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action: repository.FileActionUpdated,
					Path:   "dashboards/test.json",
					Name:   "test-dashboard",
					Kind:   "Dashboard",
					Group:  "dashboards",
				}).Return()
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

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, fmt.Errorf("write error"))

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action == repository.FileActionUpdated &&
						result.Path == "dashboards/test.json" &&
						result.Name == "test-dashboard" &&
						result.Kind == "Dashboard" &&
						result.Group == "dashboards" &&
						result.Error != nil &&
						result.Error.Error() == "writing resource from file dashboards/test.json: write error"
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

				repoResources.On("EnsureFolderPathExist", mock.Anything, "one/two/three/").Return("some-folder", nil)
				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action: repository.FileActionCreated,
					Path:   "one/two/three/",
					Name:   "some-folder",
					Kind:   "Folder",
					Group:  "folder.grafana.app",
				}).Return()
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

				repoResources.On(
					"EnsureFolderPathExist",
					mock.Anything,
					"one/two/three/",
				).Return("some-folder", errors.New("folder creation error"))
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action == repository.FileActionCreated &&
						result.Path == "one/two/three/" &&
						result.Name == "" &&
						result.Kind == "Folder" &&
						result.Group == "folder.grafana.app" &&
						result.Error != nil &&
						result.Error.Error() == "ensuring folder exists at path one/two/three/: folder creation error"
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

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action: repository.FileActionDeleted,
					Path:   "dashboards/test.json",
					Name:   "test-dashboard",
					Kind:   "Dashboard",
					Group:  "dashboards",
					Error:  nil,
				}).Return()
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
					return result.Action == repository.FileActionDeleted &&
						result.Path == "dashboards/test.json" &&
						result.Name == "test-dashboard" &&
						result.Kind == "Dashboard" &&
						result.Group == "dashboards" &&
						result.Error != nil &&
						result.Error.Error() == "deleting resource dashboards/Dashboard test-dashboard: delete failed"
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
					return result.Action == repository.FileActionDeleted &&
						result.Path == "dashboards/test.json" &&
						result.Error != nil &&
						result.Error.Error() == "processing deletion for file dashboards/test.json: missing existing reference"
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
					return result.Action == repository.FileActionDeleted &&
						result.Path == "dashboards/test.json" &&
						result.Error != nil &&
						result.Error.Error() == "processing deletion for file dashboards/test.json: missing existing reference"
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

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Name:   "test-dashboard",
					Group:  "dashboards",
					Kind:   "dashboards", // could not find a real kind
					Action: repository.FileActionDeleted,
					Path:   "dashboards/test.json",
					Error:  fmt.Errorf("get client for deleted object: %w", errors.New("didn't work")),
				}).Return()
			},
		},
		{
			name:        "successful apply with folder deletion",
			description: "Should successfully apply changes when deleting an existing folder",
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

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action: repository.FileActionDeleted,
					Path:   "to-be-deleted/",
					Name:   "test-folder",
					Kind:   "Folder",
					Group:  "folders",
					Error:  nil,
				}).Return()
			},
		},
		{
			name:        "failed to apply with folder deletion",
			description: "Should record an error when deleting a folder",
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
					return result.Action == repository.FileActionDeleted &&
						result.Path == "to-be-deleted/" &&
						result.Name == "test-folder" &&
						result.Kind == "Folder" &&
						result.Group == "folders" &&
						result.Error != nil &&
						result.Error.Error() == "deleting resource folders/Folder test-folder: delete failed"
				})).Return()
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

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/slow.json", "").
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

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action == repository.FileActionCreated &&
						result.Path == "dashboards/slow.json" &&
						result.Error != nil &&
						result.Error.Error() == "writing resource from file dashboards/slow.json: context deadline exceeded"
				})).Return().Once()

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action == repository.FileActionCreated &&
						result.Path == "dashboards/slow.json" &&
						result.Error != nil &&
						result.Error.Error() == "operation timed out after 15 seconds"
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
			compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(tt.changes, nil)
			repo.On("Config").Return(&provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
				},
			})

			progress.On("SetTotal", mock.Anything, len(tt.changes)).Return()
			err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError, tt.description)
			} else {
				require.NoError(t, err, tt.description)
			}
		})
	}
}

// TestFullSync_HierarchicalErrorHandling_FailedFolderCreation tests that when a folder
// creation fails, all nested resources are skipped with FileActionIgnored
func TestFullSync_HierarchicalErrorHandling_FailedFolderCreation(t *testing.T) {
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
		{Path: "folder1/", Action: repository.FileActionCreated},
		{Path: "folder1/subfolder/", Action: repository.FileActionCreated},
		{Path: "folder1/file1.json", Action: repository.FileActionCreated},
		{Path: "folder1/subfolder/file2.json", Action: repository.FileActionCreated},
	}

	folderErr := &resources.PathCreationError{Path: "folder1/", Err: fmt.Errorf("permission denied")}
	repoResources.On("EnsureFolderPathExist", mock.Anything, "folder1/").Return("", folderErr).Once()

	progress.On("IsNestedUnderFailedCreation", "folder1/subfolder/").Return(true).Once()
	progress.On("IsNestedUnderFailedCreation", "folder1/file1.json").Return(true).Once()
	progress.On("IsNestedUnderFailedCreation", "folder1/subfolder/file2.json").Return(true).Once()

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "folder1/" && r.Error != nil
	})).Return().Once()

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "folder1/subfolder/" && r.Action == repository.FileActionIgnored
	})).Return().Once()

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "folder1/file1.json" && r.Action == repository.FileActionIgnored
	})).Return().Once()

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "folder1/subfolder/file2.json" && r.Action == repository.FileActionIgnored
	})).Return().Once()

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changes, nil)
	progress.On("SetTotal", mock.Anything, len(changes)).Return()
	progress.On("TooManyErrors").Return(nil).Maybe()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
	require.NoError(t, err)
	progress.AssertExpectations(t)
}

// TestFullSync_HierarchicalErrorHandling_FailedFileDeletion tests folder deletion is prevented when child deletion fails
func TestFullSync_HierarchicalErrorHandling_FailedFileDeletion(t *testing.T) {
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

	changes := []ResourceFileChange{
		{
			Path:     "folder1/file1.json",
			Action:   repository.FileActionDeleted,
			Existing: &provisioning.ResourceListItem{Name: "file1", Group: "dashboard.grafana.app", Resource: "dashboards"},
		},
		{Path: "folder1/", Action: repository.FileActionDeleted},
	}

	gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard", Version: "v1"}
	gvr := schema.GroupVersionResource{Group: "dashboard.grafana.app", Resource: "dashboards", Version: "v1"}

	clients.On("ForResource", mock.Anything, mock.MatchedBy(func(gvr schema.GroupVersionResource) bool {
		return gvr.Group == "dashboard.grafana.app"
	})).Return(dynamicClient.Resource(gvr), gvk, nil)

	dynamicClient.PrependReactor("delete", "dashboards", func(action k8testing.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("permission denied")
	})

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "folder1/file1.json" && r.Error != nil
	})).Return().Once()

	progress.On("HasFailedDeletionsUnder", "folder1/").Return(true).Once()

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "folder1/" && r.Action == repository.FileActionIgnored
	})).Return().Once()

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changes, nil)
	progress.On("SetTotal", mock.Anything, len(changes)).Return()
	progress.On("TooManyErrors").Return(nil).Maybe()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
	require.NoError(t, err)
	progress.AssertExpectations(t)
}

// TestFullSync_HierarchicalErrorHandling_DeletionNotAffectedByCreationFailure tests deletions proceed despite creation failures
func TestFullSync_HierarchicalErrorHandling_DeletionNotAffectedByCreationFailure(t *testing.T) {
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

	changes := []ResourceFileChange{
		{Path: "folder1/", Action: repository.FileActionCreated},
		{
			Path:     "folder1/file1.json",
			Action:   repository.FileActionDeleted,
			Existing: &provisioning.ResourceListItem{Name: "file1", Group: "dashboard.grafana.app", Resource: "dashboards"},
		},
	}

	folderErr := &resources.PathCreationError{Path: "folder1/", Err: fmt.Errorf("permission denied")}
	repoResources.On("EnsureFolderPathExist", mock.Anything, "folder1/").Return("", folderErr).Once()

	gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard", Version: "v1"}
	gvr := schema.GroupVersionResource{Group: "dashboard.grafana.app", Resource: "dashboards", Version: "v1"}
	clients.On("ForResource", mock.Anything, mock.MatchedBy(func(gvr schema.GroupVersionResource) bool {
		return gvr.Group == "dashboard.grafana.app"
	})).Return(dynamicClient.Resource(gvr), gvk, nil)

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "folder1/" && r.Error != nil
	})).Return().Once()

	// Deletion should proceed (not check IsNestedUnderFailedCreation)
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "folder1/file1.json" && r.Action == repository.FileActionDeleted && r.Error == nil
	})).Return().Once()

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changes, nil)
	progress.On("SetTotal", mock.Anything, len(changes)).Return()
	progress.On("TooManyErrors").Return(nil).Maybe()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
	require.NoError(t, err)
	progress.AssertExpectations(t)
}

// TestFullSync_HierarchicalErrorHandling_MultiLevelNesting tests errors cascade through multiple nesting levels
func TestFullSync_HierarchicalErrorHandling_MultiLevelNesting(t *testing.T) {
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
		{Path: "level1/", Action: repository.FileActionCreated},
		{Path: "level1/level2/", Action: repository.FileActionCreated},
		{Path: "level1/level2/level3/", Action: repository.FileActionCreated},
		{Path: "level1/level2/level3/file.json", Action: repository.FileActionCreated},
	}

	folderErr := &resources.PathCreationError{Path: "level1/", Err: fmt.Errorf("permission denied")}
	repoResources.On("EnsureFolderPathExist", mock.Anything, "level1/").Return("", folderErr).Once()

	progress.On("IsNestedUnderFailedCreation", "level1/level2/").Return(true).Once()
	progress.On("IsNestedUnderFailedCreation", "level1/level2/level3/").Return(true).Once()
	progress.On("IsNestedUnderFailedCreation", "level1/level2/level3/file.json").Return(true).Once()

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "level1/" && r.Error != nil
	})).Return().Once()

	for _, path := range []string{"level1/level2/", "level1/level2/level3/", "level1/level2/level3/file.json"} {
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Path == path && r.Action == repository.FileActionIgnored
		})).Return().Once()
	}

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changes, nil)
	progress.On("SetTotal", mock.Anything, len(changes)).Return()
	progress.On("TooManyErrors").Return(nil).Maybe()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
	require.NoError(t, err)
	progress.AssertExpectations(t)
}

// TestFullSync_HierarchicalErrorHandling_MultipleFolderDeletionFailures tests multiple folder deletion failures
func TestFullSync_HierarchicalErrorHandling_MultipleFolderDeletionFailures(t *testing.T) {
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

	changes := []ResourceFileChange{
		{Path: "folder1/file1.json", Action: repository.FileActionDeleted, Existing: &provisioning.ResourceListItem{Name: "file1", Group: "dashboard.grafana.app", Resource: "dashboards"}},
		{Path: "folder1/", Action: repository.FileActionDeleted},
		{Path: "folder2/file2.json", Action: repository.FileActionDeleted, Existing: &provisioning.ResourceListItem{Name: "file2", Group: "dashboard.grafana.app", Resource: "dashboards"}},
		{Path: "folder2/", Action: repository.FileActionDeleted},
	}

	gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard", Version: "v1"}
	gvr := schema.GroupVersionResource{Group: "dashboard.grafana.app", Resource: "dashboards", Version: "v1"}
	clients.On("ForResource", mock.Anything, mock.MatchedBy(func(gvr schema.GroupVersionResource) bool {
		return gvr.Group == "dashboard.grafana.app"
	})).Return(dynamicClient.Resource(gvr), gvk, nil)

	dynamicClient.PrependReactor("delete", "dashboards", func(action k8testing.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("permission denied")
	})

	for _, path := range []string{"folder1/file1.json", "folder2/file2.json"} {
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Path == path && r.Error != nil
		})).Return().Once()
	}

	progress.On("HasFailedDeletionsUnder", "folder1/").Return(true).Once()
	progress.On("HasFailedDeletionsUnder", "folder2/").Return(true).Once()

	for _, path := range []string{"folder1/", "folder2/"} {
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Path == path && r.Action == repository.FileActionIgnored
		})).Return().Once()
	}

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changes, nil)
	progress.On("SetTotal", mock.Anything, len(changes)).Return()
	progress.On("TooManyErrors").Return(nil).Maybe()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
	require.NoError(t, err)
	progress.AssertExpectations(t)
}

// TestFullSync_HierarchicalErrorHandling_MixedSuccessAndFailure tests mixed scenarios
func TestFullSync_HierarchicalErrorHandling_MixedSuccessAndFailure(t *testing.T) {
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
		{Path: "success/", Action: repository.FileActionCreated},
		{Path: "success/file1.json", Action: repository.FileActionCreated},
		{Path: "failure/", Action: repository.FileActionCreated},
		{Path: "failure/file2.json", Action: repository.FileActionCreated},
	}

	repoResources.On("EnsureFolderPathExist", mock.Anything, "success/").Return("success-folder", nil).Once()
	repoResources.On("WriteResourceFromFile", mock.Anything, "success/file1.json", "").
		Return("resource1", schema.GroupVersionKind{Kind: "Dashboard"}, nil).Once()

	folderErr := &resources.PathCreationError{Path: "failure/", Err: fmt.Errorf("disk full")}
	repoResources.On("EnsureFolderPathExist", mock.Anything, "failure/").Return("", folderErr).Once()

	progress.On("IsNestedUnderFailedCreation", "success/file1.json").Return(false).Once()
	progress.On("IsNestedUnderFailedCreation", "failure/file2.json").Return(true).Once()

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "success/" && r.Error == nil
	})).Return().Once()

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "success/file1.json" && r.Error == nil
	})).Return().Once()

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "failure/" && r.Error != nil
	})).Return().Once()

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "failure/file2.json" && r.Action == repository.FileActionIgnored
	})).Return().Once()

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changes, nil)
	progress.On("SetTotal", mock.Anything, len(changes)).Return()
	progress.On("TooManyErrors").Return(nil).Maybe()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
	require.NoError(t, err)
	progress.AssertExpectations(t)
	repoResources.AssertExpectations(t)
}

// TestFullSync_HierarchicalErrorHandling_NestedSubfolderDeletionFailure tests nested folder deletion failure
func TestFullSync_HierarchicalErrorHandling_NestedSubfolderDeletionFailure(t *testing.T) {
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

	changes := []ResourceFileChange{
		{Path: "parent/subfolder/file.json", Action: repository.FileActionDeleted, Existing: &provisioning.ResourceListItem{Name: "file1", Group: "dashboard.grafana.app", Resource: "dashboards"}},
		{Path: "parent/subfolder/", Action: repository.FileActionDeleted},
		{Path: "parent/", Action: repository.FileActionDeleted},
	}

	gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard", Version: "v1"}
	gvr := schema.GroupVersionResource{Group: "dashboard.grafana.app", Resource: "dashboards", Version: "v1"}
	clients.On("ForResource", mock.Anything, mock.MatchedBy(func(gvr schema.GroupVersionResource) bool {
		return gvr.Group == "dashboard.grafana.app"
	})).Return(dynamicClient.Resource(gvr), gvk, nil)

	dynamicClient.PrependReactor("delete", "dashboards", func(action k8testing.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("permission denied")
	})

	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Path == "parent/subfolder/file.json" && r.Error != nil
	})).Return().Once()

	progress.On("HasFailedDeletionsUnder", "parent/subfolder/").Return(true).Once()
	progress.On("HasFailedDeletionsUnder", "parent/").Return(true).Once()

	for _, path := range []string{"parent/subfolder/", "parent/"} {
		progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Path == path && r.Action == repository.FileActionIgnored
		})).Return().Once()
	}

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changes, nil)
	progress.On("SetTotal", mock.Anything, len(changes)).Return()
	progress.On("TooManyErrors").Return(nil).Maybe()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), 10, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))
	require.NoError(t, err)
	progress.AssertExpectations(t)
}
