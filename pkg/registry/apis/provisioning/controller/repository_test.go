package controller

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller/mocks"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/applyconfiguration/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
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

func (m mockProvisioningV0alpha1Interface) Connections(namespace string) client.ConnectionInterface {
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

func TestRepositoryController_process_UnhealthyRepositoryStatusUpdate(t *testing.T) {
	testCases := []struct {
		name                     string
		repo                     *provisioning.Repository
		healthStatus             provisioning.HealthStatus
		hasHealthStatusChanged   bool
		expectedUnhealthyMessage bool
		description              string
	}{
		{
			name: "unhealthy repository should set unhealthy message in sync status",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-repo",
					Namespace:  "default",
					Generation: 1,
				},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{
						Enabled:         true,
						IntervalSeconds: 300,
					},
				},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().Add(-10 * time.Minute).UnixMilli(),
					},
					Sync: provisioning.SyncStatus{
						State:    provisioning.JobStateSuccess,
						Finished: time.Now().Add(-1 * time.Minute).UnixMilli(),
						Message:  []string{},
					},
				},
			},
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHealth,
				Checked: time.Now().UnixMilli(),
				Message: []string{"connection failed"},
			},
			hasHealthStatusChanged:   true,
			expectedUnhealthyMessage: true,
			description:              "should set unhealthy message when repository becomes unhealthy",
		},
		{
			name: "unhealthy repository should not duplicate unhealthy message",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-repo",
					Namespace:  "default",
					Generation: 1,
				},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{
						Enabled:         true,
						IntervalSeconds: 300,
					},
				},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: false,
						Checked: time.Now().Add(-2 * time.Minute).UnixMilli(),
					},
					Sync: provisioning.SyncStatus{
						State:    provisioning.JobStateError,
						Finished: time.Now().Add(-1 * time.Minute).UnixMilli(),
						Message:  []string{"Repository is unhealthy"},
					},
				},
			},
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHealth,
				Checked: time.Now().UnixMilli(),
				Message: []string{"connection failed"},
			},
			hasHealthStatusChanged:   false,
			expectedUnhealthyMessage: false,
			description:              "should not set unhealthy message when it already exists",
		},
		{
			name: "healthy repository should clear unhealthy message",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-repo",
					Namespace:  "default",
					Generation: 1,
				},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{
						Enabled:         true,
						IntervalSeconds: 300,
					},
				},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: false,
						Checked: time.Now().Add(-2 * time.Minute).UnixMilli(),
					},
					Sync: provisioning.SyncStatus{
						State:    provisioning.JobStateError,
						Finished: time.Now().Add(-1 * time.Minute).UnixMilli(),
						Message:  []string{"Repository is unhealthy"},
					},
				},
			},
			healthStatus: provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().UnixMilli(),
				Message: []string{},
			},
			hasHealthStatusChanged:   true,
			expectedUnhealthyMessage: false,
			description:              "should clear unhealthy message when repository becomes healthy",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create controller
			rc := &RepositoryController{}

			// Determine sync status ops (this is a pure function, no mocks needed)
			syncOps := rc.determineSyncStatusOps(tc.repo, nil, tc.healthStatus)

			// Verify expectations
			hasUnhealthyOp := false
			hasClearUnhealthyOp := false
			for _, op := range syncOps {
				if path, ok := op["path"].(string); ok {
					if path == "/status/sync/message" {
						if messages, ok := op["value"].([]string); ok {
							if len(messages) > 0 && messages[0] == "Repository is unhealthy" {
								hasUnhealthyOp = true
							} else if len(messages) == 0 {
								hasClearUnhealthyOp = true
							}
						}
					}
				}
			}

			if tc.expectedUnhealthyMessage {
				assert.True(t, hasUnhealthyOp, tc.description+": expected unhealthy message operation")
			} else if len(tc.repo.Status.Sync.Message) > 0 && tc.healthStatus.Healthy {
				assert.True(t, hasClearUnhealthyOp, tc.description+": expected clear unhealthy message operation")
			}
		})
	}
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

// capturingStatusPatcher records all Patch calls for later inspection.
type capturingStatusPatcher struct {
	calls [][]map[string]interface{}
}

func (c *capturingStatusPatcher) Patch(_ context.Context, _ *provisioning.Repository, ops ...map[string]interface{}) error {
	c.calls = append(c.calls, ops)
	return nil
}

func (c *capturingStatusPatcher) findPatchOp(path string) (map[string]interface{}, bool) {
	for _, ops := range c.calls {
		for _, op := range ops {
			if op["path"] == path {
				return op, true
			}
		}
	}
	return nil, false
}

func TestRepositoryController_process_QuotaUpdateTriggersReconciliation(t *testing.T) {
	testCases := []struct {
		name             string
		oldQuota         provisioning.QuotaStatus
		newQuota         provisioning.QuotaStatus
		expectReconcile  bool
		expectQuotaPatch bool
	}{
		{
			name: "quota change triggers reconciliation and patches status",
			oldQuota: provisioning.QuotaStatus{
				MaxRepositories:           5,
				MaxResourcesPerRepository: 100,
			},
			newQuota: provisioning.QuotaStatus{
				MaxRepositories:           10,
				MaxResourcesPerRepository: 200,
			},
			expectReconcile:  true,
			expectQuotaPatch: true,
		},
		{
			name: "unchanged quota skips reconciliation",
			oldQuota: provisioning.QuotaStatus{
				MaxRepositories:           5,
				MaxResourcesPerRepository: 100,
			},
			newQuota: provisioning.QuotaStatus{
				MaxRepositories:           5,
				MaxResourcesPerRepository: 100,
			},
			expectReconcile:  false,
			expectQuotaPatch: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			namespace := "default"
			repoName := "test-repo"

			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       repoName,
					Namespace:  namespace,
					Generation: 1,
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.LocalRepositoryType,
					Sync: provisioning.SyncOptions{
						Enabled: false,
					},
				},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().UnixMilli(),
					},
					Quota: tc.oldQuota,
				},
			}

			indexer := cache.NewIndexer(
				cache.MetaNamespaceKeyFunc,
				cache.Indexers{cache.NamespaceIndex: cache.MetaNamespaceIndexFunc},
			)
			require.NoError(t, indexer.Add(repo))
			repoLister := listers.NewRepositoryLister(indexer)

			patcher := &capturingStatusPatcher{}

			healthMetrics := NewMockHealthMetricsRecorder(t)
			healthMetrics.EXPECT().
				RecordHealthCheck(mock.Anything, mock.Anything, mock.Anything).
				Maybe()

			tester := repository.NewTester()
			healthChecker := NewRepositoryHealthChecker(patcher, tester, healthMetrics)

			mockRepo := repository.NewMockRepository(t)
			mockRepo.On("Config").Return(repo).Maybe()
			mockRepo.On("Test", mock.Anything).
				Return(&provisioning.TestResults{Success: true}, nil).Maybe()

			repoFactory := repository.NewMockFactory(t)
			repoFactory.On("Build", mock.Anything, mock.Anything).
				Return(mockRepo, nil).Maybe()

			mockJobs := &mockJobsQueueStore{
				MockQueue: jobs.NewMockQueue(t),
				MockStore: jobs.NewMockStore(t),
			}

			rc := &RepositoryController{
				repoLister:    repoLister,
				quotaGetter:   quotas.NewFixedQuotaGetter(tc.newQuota),
				quotaChecker:  NewRepositoryQuotaChecker(repoLister),
				healthChecker: healthChecker,
				statusPatcher: patcher,
				repoFactory:   repoFactory,
				jobs:          mockJobs,
				logger:        logging.DefaultLogger.With("logger", loggerName),
				tracer:        tracing.InitializeTracerForTest(),
			}

			err := rc.process(&queueItem{key: namespace + "/" + repoName})
			assert.NoError(t, err)

			if tc.expectReconcile {
				assert.NotEmpty(t, patcher.calls,
					"expected status patcher to be called during reconciliation")
			} else {
				assert.Empty(t, patcher.calls,
					"expected no status patch when reconciliation is skipped")
			}

			if tc.expectQuotaPatch {
				quotaOp, found := patcher.findPatchOp("/status/quota")
				assert.True(t, found, "expected /status/quota patch operation")
				if found {
					assert.Equal(t, "replace", quotaOp["op"])
					assert.Equal(t, tc.newQuota, quotaOp["value"])
				}

				condOp, found := patcher.findPatchOp("/status/conditions")
				assert.True(t, found,
					"expected /status/conditions patch operation for quota condition update")
				if found {
					conditions, ok := condOp["value"].([]metav1.Condition)
					assert.True(t, ok, "conditions value should be []metav1.Condition")
					if ok {
						var quotaCond *metav1.Condition
						for i := range conditions {
							if conditions[i].Type == provisioning.ConditionTypeNamespaceQuota {
								quotaCond = &conditions[i]
								break
							}
						}
						assert.NotNil(t, quotaCond,
							"expected NamespaceQuota condition to be present")
					}
				}
			}
		})
	}
}
