package sync

import (
	"context"
	"errors"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8testing "k8s.io/client-go/testing"
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

	err := FullSync(ctx, repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
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

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
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

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
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

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
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

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
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

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
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
				// First call returns nil, second call returns error
				progress.On("TooManyErrors").Return(nil).Once()
				progress.On("TooManyErrors").Return(fmt.Errorf("too many errors")).Once()

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/one.json", "").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action:   repository.FileActionCreated,
					Path:     "dashboards/one.json",
					Name:     "test-dashboard",
					Resource: resources.DashboardResource.Resource,
					Group:    "dashboards",
				}).Return()
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
					Action:   repository.FileActionCreated,
					Path:     "dashboards/test.json",
					Name:     "test-dashboard",
					Resource: resources.DashboardResource.Resource,
					Group:    "dashboards",
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
						result.Resource == "Dashboard" &&
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
					Action:   repository.FileActionUpdated,
					Path:     "dashboards/test.json",
					Name:     "test-dashboard",
					Resource: resources.DashboardResource.Resource,
					Group:    "dashboards",
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
						result.Resource == "Dashboard" &&
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
					// FIXME: this is probably inconsistent across the codebase
					Resource: "folders",
					Group:    "folder.grafana.app",
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
						result.Resource == "folders" &&
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
						Resource: resources.DashboardResource.Resource,
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

				clients.On("ForResource", schema.GroupVersionResource{
					Group:    "dashboards",
					Resource: resources.DashboardResource.Resource,
				}).Return(fakeDynamicClient.Resource(resources.DashboardResource), schema.GroupVersionKind{
					Kind:    "Dashboard",
					Group:   "dashboards",
					Version: "v1",
				}, nil)

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action:   repository.FileActionDeleted,
					Path:     "dashboards/test.json",
					Name:     "test-dashboard",
					Resource: resources.DashboardResource.Resource,
					Group:    "dashboards",
					Error:    nil,
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
						Resource: resources.DashboardResource.Resource,
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

				clients.On("ForResource", schema.GroupVersionResource{
					Group:    "dashboards",
					Resource: resources.DashboardResource.Resource,
				}).Return(fakeDynamicClient.Resource(resources.DashboardResource), schema.GroupVersionKind{
					Kind:    "Dashboard",
					Group:   "dashboards",
					Version: "v1",
				}, nil)

				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Action == repository.FileActionDeleted &&
						result.Path == "dashboards/test.json" &&
						result.Name == "test-dashboard" &&
						result.Resource == resources.DashboardResource.Resource &&
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
						Resource: resources.DashboardResource.Resource,
					},
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("TooManyErrors").Return(nil)

				clients.On("ForResource", schema.GroupVersionResource{
					Group:    "dashboards",
					Resource: resources.DashboardResource.Resource,
				}).Return(nil, schema.GroupVersionKind{}, errors.New("didn't work"))

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Name:     "test-dashboard",
					Group:    "dashboards",
					Resource: resources.DashboardResource.Resource,
					Action:   repository.FileActionDeleted,
					Path:     "dashboards/test.json",
					Error:    fmt.Errorf("get client for deleted object: %w", errors.New("didn't work")),
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

				clients.On("ForResource", schema.GroupVersionResource{
					Group:    "folders",
					Resource: "Folder",
				}).Return(fakeDynamicClient.Resource(resources.FolderResource), schema.GroupVersionKind{
					Kind:    "Folder",
					Group:   "folders",
					Version: "v1",
				}, nil)

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action:   repository.FileActionDeleted,
					Path:     "to-be-deleted/",
					Name:     "test-folder",
					Resource: "Folder",
					Group:    "folders",
					Error:    nil,
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

				clients.On("ForResource", schema.GroupVersionResource{
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
						result.Resource == "Folder" &&
						result.Group == "folders" &&
						result.Error != nil &&
						result.Error.Error() == "deleting resource folders/Folder test-folder: delete failed"
				})).Return()
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
			err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError, tt.description)
			} else {
				require.NoError(t, err, tt.description)
			}
		})
	}
}
