package controller

import (
	"context"
	"testing"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller/mocks"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/apimachinery/pkg/labels"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/applyconfiguration/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

type mockProvisioningV0alpha1Interface struct {
	repositoriesFunc func(namespace string) client.RepositoryInterface
}

func (m mockProvisioningV0alpha1Interface) RESTClient() rest.Interface {
	panic("not needed for testing")
}

func (m mockProvisioningV0alpha1Interface) HistoricJobs(namespace string) client.HistoricJobInterface {
	panic("not needed for testing")
}

func (m mockProvisioningV0alpha1Interface) Jobs(namespace string) client.JobInterface {
	panic("not needed for testing")
}

func (m mockProvisioningV0alpha1Interface) Repositories(namespace string) client.RepositoryInterface {
	if m.repositoriesFunc != nil {
		return m.repositoriesFunc(namespace)
	}
	return nil
}

type mockRepoInterface struct {
	patchFunc func(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions, subresources ...string) (result *provisioning.Repository, err error)
}

func (m mockRepoInterface) Create(ctx context.Context, repository *provisioning.Repository, opts metav1.CreateOptions) (*provisioning.Repository, error) {
	panic("not needed for testing")
}

func (m mockRepoInterface) Update(ctx context.Context, repository *provisioning.Repository, opts metav1.UpdateOptions) (*provisioning.Repository, error) {
	panic("not needed for testing")
}

func (m mockRepoInterface) UpdateStatus(ctx context.Context, repository *provisioning.Repository, opts metav1.UpdateOptions) (*provisioning.Repository, error) {
	panic("not needed for testing")
}

func (m mockRepoInterface) Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error {
	panic("not needed for testing")
}

func (m mockRepoInterface) DeleteCollection(ctx context.Context, opts metav1.DeleteOptions, listOpts metav1.ListOptions) error {
	panic("not needed for testing")
}

func (m mockRepoInterface) Get(ctx context.Context, name string, opts metav1.GetOptions) (*provisioning.Repository, error) {
	panic("not needed for testing")
}

func (m mockRepoInterface) List(ctx context.Context, opts metav1.ListOptions) (*provisioning.RepositoryList, error) {
	panic("not needed for testing")
}

func (m mockRepoInterface) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	panic("not needed for testing")
}

func (m mockRepoInterface) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions, subresources ...string) (result *provisioning.Repository, err error) {
	if m.patchFunc != nil {
		return m.patchFunc(ctx, name, pt, data, opts, subresources...)
	}
	return nil, nil
}

func (m mockRepoInterface) Apply(ctx context.Context, repository *provisioningv0alpha1.RepositoryApplyConfiguration, opts metav1.ApplyOptions) (result *provisioning.Repository, err error) {
	panic("not needed for testing")
}

func (m mockRepoInterface) ApplyStatus(ctx context.Context, repository *provisioningv0alpha1.RepositoryApplyConfiguration, opts metav1.ApplyOptions) (result *provisioning.Repository, err error) {
	panic("not needed for testing")
}

var (
	_ client.ProvisioningV0alpha1Interface = (*mockProvisioningV0alpha1Interface)(nil)
	_ client.RepositoryInterface           = (*mockRepoInterface)(nil)
)

func TestRepositoryController_handleDelete(t *testing.T) {
	testCases := []struct {
		name          string
		repoFactory   repository.Factory
		finalizer     finalizerProcessor
		client        client.ProvisioningV0alpha1Interface
		statusPatcher StatusPatcher
		repo          *provisioning.Repository
		expectedErr   string
	}{
		{
			name:          "No finalizers",
			repoFactory:   nil,
			finalizer:     nil,
			client:        nil,
			statusPatcher: nil,
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Finalizers: []string{},
				},
			},
		},
		{
			name: "Finalizers deleted successfully",
			repoFactory: func() repository.Factory {
				f := repository.NewMockFactory(t)

				f.
					On("Build", context.Background(), mock.Anything).
					Once().
					Return(nil, nil)

				return f
			}(),
			finalizer: func() finalizerProcessor {
				f := NewMockFinalizerProcessor(t)

				f.
					On("process", context.Background(), nil, []string{
						repository.RemoveOrphanResourcesFinalizer,
					}).
					Once().
					Return(nil)

				return f
			}(),
			client: func() client.ProvisioningV0alpha1Interface {
				repo := &mockRepoInterface{
					patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions, subresources ...string) (result *provisioning.Repository, err error) {
						return &provisioning.Repository{}, nil
					},
				}
				c := &mockProvisioningV0alpha1Interface{
					repositoriesFunc: func(namespace string) client.RepositoryInterface {
						return repo
					},
				}

				return c
			}(),
			statusPatcher: nil,
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Finalizers: []string{
						repository.RemoveOrphanResourcesFinalizer,
					},
				},
			},
		},
		{
			name: "Error when building repository",
			repoFactory: func() repository.Factory {
				f := repository.NewMockFactory(t)

				f.
					On("Build", context.Background(), mock.Anything).
					Once().
					Return(nil, assert.AnError)

				return f
			}(),
			finalizer:     nil,
			client:        nil,
			statusPatcher: nil,
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Finalizers: []string{
						repository.RemoveOrphanResourcesFinalizer,
					},
				},
			},
			expectedErr: "create repository from configuration: " + assert.AnError.Error(),
		},
		{
			name: "Error when processing finalizer",
			repoFactory: func() repository.Factory {
				f := repository.NewMockFactory(t)

				f.
					On("Build", context.Background(), mock.Anything).
					Once().
					Return(nil, nil)

				return f
			}(),
			finalizer: func() finalizerProcessor {
				f := NewMockFinalizerProcessor(t)

				f.
					On("process", context.Background(), nil, []string{
						repository.RemoveOrphanResourcesFinalizer,
					}).
					Once().
					Return(assert.AnError)

				return f
			}(),
			statusPatcher: func() StatusPatcher {
				s := mocks.NewStatusPatcher(t)

				s.
					On("Patch", context.Background(), mock.AnythingOfType("*v0alpha1.Repository"), mock.AnythingOfType("map[string]interface {}")).
					Once().
					Return(nil) // Return nil error for the status patch

				return s
			}(),
			client: nil,
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Finalizers: []string{
						repository.RemoveOrphanResourcesFinalizer,
					},
				},
			},
			expectedErr: "process finalizers: " + assert.AnError.Error(),
		},
		{
			name: "Error when patching finalizers",
			repoFactory: func() repository.Factory {
				f := repository.NewMockFactory(t)

				f.
					On("Build", context.Background(), mock.Anything).
					Once().
					Return(nil, nil)

				return f
			}(),
			finalizer: func() finalizerProcessor {
				f := NewMockFinalizerProcessor(t)

				f.
					On("process", context.Background(), nil, []string{
						repository.RemoveOrphanResourcesFinalizer,
					}).
					Once().
					Return(nil)

				return f
			}(),
			client: func() client.ProvisioningV0alpha1Interface {
				repo := &mockRepoInterface{
					patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions, subresources ...string) (result *provisioning.Repository, err error) {
						return &provisioning.Repository{}, assert.AnError
					},
				}
				c := &mockProvisioningV0alpha1Interface{
					repositoriesFunc: func(namespace string) client.RepositoryInterface {
						return repo
					},
				}

				return c
			}(),
			statusPatcher: nil,
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Finalizers: []string{
						repository.RemoveOrphanResourcesFinalizer,
					},
				},
			},
			expectedErr: "remove finalizers: " + assert.AnError.Error(),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			c := &RepositoryController{
				repoFactory:   tc.repoFactory,
				finalizer:     tc.finalizer,
				client:        tc.client,
				statusPatcher: tc.statusPatcher,
			}

			err := c.handleDelete(context.Background(), tc.repo)
			if tc.expectedErr != "" {
				assert.Error(t, err)
				assert.ErrorContains(t, err, tc.expectedErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestShouldUseIncrementalSync(t *testing.T) {
	versioned := repository.NewMockVersioned(t)
	obj := &provisioning.Repository{
		Status: provisioning.RepositoryStatus{
			Sync: provisioning.SyncStatus{
				LastRef: "123",
			},
		},
	}
	latestRef := "456"
	t.Run("should use incremental sync", func(t *testing.T) {
		versioned.On("CompareFiles", context.Background(), obj.Status.Sync.LastRef, latestRef).Return([]repository.VersionedFileChange{
			{
				Action: repository.FileActionDeleted,
				Path:   "test.json",
			},
		}, nil).Once()
		got, err := shouldUseIncrementalSync(context.Background(), versioned, obj, latestRef)
		assert.NoError(t, err)
		assert.True(t, got)
	})

	t.Run("should not use incremental sync", func(t *testing.T) {
		versioned.On("CompareFiles", context.Background(), obj.Status.Sync.LastRef, latestRef).Return([]repository.VersionedFileChange{
			{
				Action: repository.FileActionDeleted,
				Path:   "test/.keep",
			},
		}, nil).Once()
		got, err := shouldUseIncrementalSync(context.Background(), versioned, obj, latestRef)
		assert.NoError(t, err)
		assert.False(t, got)
	})
}

// mockJobsQueueStore implements both jobs.Queue and jobs.Store for testing
type mockJobsQueueStore struct {
	*jobs.MockQueue
	*jobs.MockStore
}

// mockRepositoryLister implements listers.RepositoryLister for testing
type mockRepositoryLister struct {
	repositoriesFunc func(namespace string) listers.RepositoryNamespaceLister
}

func (m *mockRepositoryLister) Repositories(namespace string) listers.RepositoryNamespaceLister {
	if m.repositoriesFunc != nil {
		return m.repositoriesFunc(namespace)
	}
	return nil
}

func (m *mockRepositoryLister) List(selector labels.Selector) ([]*provisioning.Repository, error) {
	panic("not needed for testing")
}

// mockRepositoryNamespaceLister implements listers.RepositoryNamespaceLister for testing
type mockRepositoryNamespaceLister struct {
	getFunc func(name string) (*provisioning.Repository, error)
}

func (m *mockRepositoryNamespaceLister) Get(name string) (*provisioning.Repository, error) {
	if m.getFunc != nil {
		return m.getFunc(name)
	}
	return nil, nil
}

func (m *mockRepositoryNamespaceLister) List(selector labels.Selector) ([]*provisioning.Repository, error) {
	panic("not needed for testing")
}

func TestRepositoryController_shouldResync_StaleSyncStatus(t *testing.T) {
	testCases := []struct {
		name           string
		repo           *provisioning.Repository
		jobGetError    error
		expectedResync bool
		description    string
	}{
		{
			name: "stale sync status with Pending state - job not found",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{
						Enabled:         true,
						IntervalSeconds: 300,
					},
				},
				Status: provisioning.RepositoryStatus{
					Sync: provisioning.SyncStatus{
						State:    provisioning.JobStatePending,
						JobID:    "test-job-123",
						Started:  time.Now().Add(-10 * time.Minute).UnixMilli(),
						Finished: time.Now().Add(-10 * time.Minute).UnixMilli(),
					},
				},
			},
			jobGetError:    apierrors.NewNotFound(schema.GroupResource{Resource: "jobs"}, "test-job-123"),
			expectedResync: true,
			description:    "should return true to trigger resync when job is not found",
		},
		{
			name: "stale sync status with Working state - job not found",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{
						Enabled:         true,
						IntervalSeconds: 300,
					},
				},
				Status: provisioning.RepositoryStatus{
					Sync: provisioning.SyncStatus{
						State:    provisioning.JobStateWorking,
						JobID:    "test-job-456",
						Started:  time.Now().Add(-5 * time.Minute).UnixMilli(),
						Finished: time.Now().Add(-5 * time.Minute).UnixMilli(),
					},
				},
			},
			jobGetError:    apierrors.NewNotFound(schema.GroupResource{Resource: "jobs"}, "test-job-456"),
			expectedResync: true,
			description:    "should return true to trigger resync when working job is not found",
		},
		{
			name: "non-stale sync status - job exists",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{
						Enabled:         true,
						IntervalSeconds: 300,
					},
				},
				Status: provisioning.RepositoryStatus{
					Sync: provisioning.SyncStatus{
						State:    provisioning.JobStatePending,
						JobID:    "test-job-789",
						Started:  time.Now().Add(-2 * time.Minute).UnixMilli(),
						Finished: time.Now().Add(-2 * time.Minute).UnixMilli(),
					},
				},
			},
			jobGetError:    nil,   // Job exists
			expectedResync: false, // Should continue with normal logic
			description:    "should continue with normal logic when job exists",
		},
		{
			name: "non-stale sync status - no JobID",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{
						Enabled:         true,
						IntervalSeconds: 300,
					},
				},
				Status: provisioning.RepositoryStatus{
					Sync: provisioning.SyncStatus{
						State:    provisioning.JobStatePending,
						JobID:    "",
						Started:  time.Now().Add(-2 * time.Minute).UnixMilli(),
						Finished: time.Now().Add(-2 * time.Minute).UnixMilli(),
					},
				},
			},
			jobGetError:    nil,
			expectedResync: false,
			description:    "should not check when JobID is empty",
		},
		{
			name: "non-stale sync status - already finished",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{
						Enabled:         true,
						IntervalSeconds: 300,
					},
				},
				Status: provisioning.RepositoryStatus{
					Sync: provisioning.SyncStatus{
						State:    provisioning.JobStateSuccess,
						JobID:    "test-job-999",
						Finished: time.Now().Add(-1 * time.Minute).UnixMilli(),
					},
				},
			},
			jobGetError:    nil,
			expectedResync: false,
			description:    "should not check when sync status is already finished",
		},
		{
			name: "stale sync status - job lookup error (non-NotFound)",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{
						Enabled:         true,
						IntervalSeconds: 300,
					},
				},
				Status: provisioning.RepositoryStatus{
					Sync: provisioning.SyncStatus{
						State:    provisioning.JobStatePending,
						JobID:    "test-job-error",
						Started:  time.Now().Add(-2 * time.Minute).UnixMilli(),
						Finished: time.Now().Add(-2 * time.Minute).UnixMilli(),
					},
				},
			},
			jobGetError:    assert.AnError, // Non-NotFound error
			expectedResync: false,          // Should continue with normal logic
			description:    "should handle non-NotFound errors gracefully and continue with normal logic",
		},
		{
			name: "stale sync status but sync disabled",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{
						Enabled:         false,
						IntervalSeconds: 300,
					},
				},
				Status: provisioning.RepositoryStatus{
					Sync: provisioning.SyncStatus{
						State:    provisioning.JobStatePending,
						JobID:    "test-job-disabled",
						Started:  time.Now().Add(-10 * time.Minute).UnixMilli(),
						Finished: time.Now().Add(-10 * time.Minute).UnixMilli(),
					},
				},
			},
			jobGetError:    apierrors.NewNotFound(schema.GroupResource{Resource: "jobs"}, "test-job-disabled"),
			expectedResync: false, // Should return false when sync is disabled
			description:    "should return false when sync is disabled even if job is stale",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockQueue := jobs.NewMockQueue(t)
			mockStore := jobs.NewMockStore(t)
			mockJobs := &mockJobsQueueStore{
				MockQueue: mockQueue,
				MockStore: mockStore,
			}

			// Set up job Get mock
			if tc.repo.Status.Sync.JobID != "" && (tc.repo.Status.Sync.State == provisioning.JobStatePending || tc.repo.Status.Sync.State == provisioning.JobStateWorking) {
				mockStore.On("Get", mock.Anything, tc.repo.Namespace, tc.repo.Status.Sync.JobID).Return(nil, tc.jobGetError).Once()
			}

			// Create controller
			rc := &RepositoryController{
				jobs: mockJobs,
			}

			// Test shouldResync
			ctx := context.Background()
			result := rc.shouldResync(ctx, tc.repo)

			// Verify
			assert.Equal(t, tc.expectedResync, result, tc.description)
		})
	}
}
