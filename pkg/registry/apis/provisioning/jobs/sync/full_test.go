package sync

import (
	"context"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
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
	progress.On("SetMessage", mock.Anything, "replicating changes").Return()

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

func TestFullSync_ApplyChanges(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*repository.MockRepository, *resources.MockRepositoryResources, *resources.MockResourceClients, *jobs.MockJobProgressRecorder, *MockCompareFn)
		changes       []ResourceFileChange
		expectedError string
		description   string
	}{
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
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating changes").Return()
				progress.On("SetMessage", mock.Anything, "changes replicated").Return()
				progress.On("TooManyErrors").Return(nil)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action:   repository.FileActionCreated,
					Path:     "dashboards/test.json",
					Name:     "test-dashboard",
					Resource: "Dashboard",
					Group:    "dashboards",
				}).Return()
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
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating changes").Return()
				progress.On("SetMessage", mock.Anything, "changes replicated").Return()
				progress.On("TooManyErrors").Return(nil)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action:   repository.FileActionUpdated,
					Path:     "dashboards/test.json",
					Name:     "test-dashboard",
					Resource: "Dashboard",
					Group:    "dashboards",
				}).Return()
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
						Resource: "Dashboard",
						Group:    "dashboards",
					},
				},
			},
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating changes").Return()
				progress.On("SetMessage", mock.Anything, "changes replicated").Return()
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
					Resource: "Dashboard",
				}).Return(fakeDynamicClient, schema.GroupVersionKind{
					Kind:    "Dashboard",
					Group:   "dashboards",
					Version: "v1",
				}, nil)

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action:   repository.FileActionDeleted,
					Path:     "dashboards/test.json",
					Name:     "test-dashboard",
					Resource: "Dashboard",
					Group:    "dashboards",
					Error:    nil,
				}).Return()
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

			err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError, tt.description)
			} else {
				require.NoError(t, err, tt.description)
			}
		})
	}
}
