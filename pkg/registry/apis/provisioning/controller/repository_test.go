package controller

import (
	"context"
	"net/http"
	"sync/atomic"
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
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	provisioningv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/applyconfiguration/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type mockProvisioningV0alpha1Interface struct {
	repositoriesFunc func(namespace string) client.RepositoryInterface
	connectionsFunc  func(namespace string) client.ConnectionInterface
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
	if m.connectionsFunc != nil {
		return m.connectionsFunc(namespace)
	}
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

type mockConnectionInterface struct {
	getFunc func(ctx context.Context, name string, opts metav1.GetOptions) (*provisioning.Connection, error)
}

func (m mockConnectionInterface) Create(_ context.Context, _ *provisioning.Connection, _ metav1.CreateOptions) (*provisioning.Connection, error) {
	panic("not needed for testing")
}

func (m mockConnectionInterface) Update(_ context.Context, _ *provisioning.Connection, _ metav1.UpdateOptions) (*provisioning.Connection, error) {
	panic("not needed for testing")
}

func (m mockConnectionInterface) UpdateStatus(_ context.Context, _ *provisioning.Connection, _ metav1.UpdateOptions) (*provisioning.Connection, error) {
	panic("not needed for testing")
}

func (m mockConnectionInterface) Delete(_ context.Context, _ string, _ metav1.DeleteOptions) error {
	panic("not needed for testing")
}

func (m mockConnectionInterface) DeleteCollection(_ context.Context, _ metav1.DeleteOptions, _ metav1.ListOptions) error {
	panic("not needed for testing")
}

func (m mockConnectionInterface) Get(ctx context.Context, name string, opts metav1.GetOptions) (*provisioning.Connection, error) {
	if m.getFunc != nil {
		return m.getFunc(ctx, name, opts)
	}
	panic("not needed for testing")
}

func (m mockConnectionInterface) List(_ context.Context, _ metav1.ListOptions) (*provisioning.ConnectionList, error) {
	panic("not needed for testing")
}

func (m mockConnectionInterface) Watch(_ context.Context, _ metav1.ListOptions) (watch.Interface, error) {
	panic("not needed for testing")
}

func (m mockConnectionInterface) Patch(_ context.Context, _ string, _ types.PatchType, _ []byte, _ metav1.PatchOptions, _ ...string) (*provisioning.Connection, error) {
	panic("not needed for testing")
}

func (m mockConnectionInterface) Apply(_ context.Context, _ *provisioningv0alpha1.ConnectionApplyConfiguration, _ metav1.ApplyOptions) (*provisioning.Connection, error) {
	panic("not needed for testing")
}

func (m mockConnectionInterface) ApplyStatus(_ context.Context, _ *provisioningv0alpha1.ConnectionApplyConfiguration, _ metav1.ApplyOptions) (*provisioning.Connection, error) {
	panic("not needed for testing")
}

var (
	_ client.ProvisioningV0alpha1Interface = (*mockProvisioningV0alpha1Interface)(nil)
	_ client.RepositoryInterface           = (*mockRepoInterface)(nil)
	_ client.ConnectionInterface           = (*mockConnectionInterface)(nil)
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

	largePolicy := repository.NewIncrementalSyncPolicy(false, 1000)

	t.Run("should use incremental sync", func(t *testing.T) {
		versioned.On("CompareFiles", context.Background(), obj.Status.Sync.LastRef, latestRef).Return([]repository.VersionedFileChange{
			{
				Action: repository.FileActionDeleted,
				Path:   "test.json",
			},
		}, nil).Once()
		got, err := shouldUseIncrementalSync(context.Background(), versioned, obj, latestRef, largePolicy)
		assert.NoError(t, err)
		assert.True(t, got)
	})

	t.Run("should not use incremental sync when folder-only metadata is deleted", func(t *testing.T) {
		versioned.On("CompareFiles", context.Background(), obj.Status.Sync.LastRef, latestRef).Return([]repository.VersionedFileChange{
			{
				Action: repository.FileActionDeleted,
				Path:   "test/.keep",
			},
		}, nil).Once()
		got, err := shouldUseIncrementalSync(context.Background(), versioned, obj, latestRef, largePolicy)
		assert.NoError(t, err)
		assert.False(t, got)
	})

	t.Run("should use incremental sync when diff is one under the max size", func(t *testing.T) {
		policy := repository.NewIncrementalSyncPolicy(false, 100)
		changes := make([]repository.VersionedFileChange, 99)
		for i := range changes {
			changes[i] = repository.VersionedFileChange{Action: repository.FileActionCreated, Path: "dashboards/d.json"}
		}
		versioned.On("CompareFiles", context.Background(), obj.Status.Sync.LastRef, latestRef).Return(changes, nil).Once()
		got, err := shouldUseIncrementalSync(context.Background(), versioned, obj, latestRef, policy)
		assert.NoError(t, err)
		assert.True(t, got, "diff one under threshold must stay incremental")
	})

	t.Run("should use incremental sync when diff is at the max size", func(t *testing.T) {
		policy := repository.NewIncrementalSyncPolicy(false, 100)
		changes := make([]repository.VersionedFileChange, 100)
		for i := range changes {
			changes[i] = repository.VersionedFileChange{Action: repository.FileActionCreated, Path: "dashboards/d.json"}
		}
		versioned.On("CompareFiles", context.Background(), obj.Status.Sync.LastRef, latestRef).Return(changes, nil).Once()
		got, err := shouldUseIncrementalSync(context.Background(), versioned, obj, latestRef, policy)
		assert.NoError(t, err)
		assert.True(t, got, "diff at threshold must stay incremental (strict >)")
	})

	t.Run("should not use incremental sync when diff exceeds max size", func(t *testing.T) {
		policy := repository.NewIncrementalSyncPolicy(false, 100)
		changes := make([]repository.VersionedFileChange, 101)
		for i := range changes {
			changes[i] = repository.VersionedFileChange{Action: repository.FileActionCreated, Path: "dashboards/d.json"}
		}
		versioned.On("CompareFiles", context.Background(), obj.Status.Sync.LastRef, latestRef).Return(changes, nil).Once()
		got, err := shouldUseIncrementalSync(context.Background(), versioned, obj, latestRef, policy)
		assert.NoError(t, err)
		assert.False(t, got, "diff above threshold must force a full sync")
	})

	t.Run("should use incremental sync when max is zero (unlimited)", func(t *testing.T) {
		policy := repository.NewIncrementalSyncPolicy(false, 0)
		changes := make([]repository.VersionedFileChange, 1000)
		for i := range changes {
			changes[i] = repository.VersionedFileChange{Action: repository.FileActionCreated, Path: "dashboards/d.json"}
		}
		versioned.On("CompareFiles", context.Background(), obj.Status.Sync.LastRef, latestRef).Return(changes, nil).Once()
		got, err := shouldUseIncrementalSync(context.Background(), versioned, obj, latestRef, policy)
		assert.NoError(t, err)
		assert.True(t, got, "max_incremental_changes=0 disables the size check (unlimited)")
	})

	t.Run("propagates CompareFiles error without deciding", func(t *testing.T) {
		versioned.On("CompareFiles", context.Background(), obj.Status.Sync.LastRef, latestRef).Return(nil, assert.AnError).Once()
		got, err := shouldUseIncrementalSync(context.Background(), versioned, obj, latestRef, largePolicy)
		assert.Error(t, err)
		assert.False(t, got, "on CompareFiles error the decision defaults to full sync (returned as false)")
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

// capturePatcher captures all patch operations for inspection in tests.
type capturePatcher struct {
	ops []map[string]interface{}
}

func (c *capturePatcher) Patch(_ context.Context, _ *provisioning.Repository, patchOperations ...map[string]interface{}) error {
	c.ops = append(c.ops, patchOperations...)
	return nil
}

func (c *capturePatcher) findPatchOp(path string) (map[string]interface{}, bool) {
	for _, op := range c.ops {
		if op["path"] == path {
			return op, true
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

			patcher := &capturePatcher{}

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
				assert.NotEmpty(t, patcher.ops,
					"expected status patcher to be called during reconciliation")
			} else {
				assert.Empty(t, patcher.ops,
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

// TestRepositoryController_process_ConditionsNotOverwritten verifies that the reconciliation loop
// produces a final /status/conditions patch containing both the quota and ready condition.
func TestRepositoryController_process_ConditionsNotOverwritten(t *testing.T) {
	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-repo",
			Namespace:  "default",
			Generation: 2,
		},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.LocalRepositoryType,
			Sync: provisioning.SyncOptions{
				Enabled: false,
			},
		},
		Status: provisioning.RepositoryStatus{
			ObservedGeneration: 1,
		},
	}

	mockNamespaceLister := &MockRepositoryNamespaceLister{}
	mockNamespaceLister.On("List", mock.Anything).Return([]*provisioning.Repository{repo}, nil)
	mockNamespaceLister.On("Get", repo.Name).Return(repo, nil)
	mockLister := &MockRepositoryLister{namespaceLister: mockNamespaceLister}

	mockMetrics := NewMockHealthMetricsRecorder(t)
	mockMetrics.EXPECT().RecordHealthCheck(mock.Anything, mock.Anything, mock.Anything).Return()

	tester := repository.NewTester()
	healthChecker := NewRepositoryHealthChecker(nil, tester, mockMetrics)

	mockConfigRepo := repository.NewMockConfigRepository(t)
	mockConfigRepo.EXPECT().Config().Return(repo)
	mockConfigRepo.EXPECT().Test(mock.Anything).Return(
		&provisioning.TestResults{Success: true, Code: http.StatusOK},
		nil,
	)

	mockFactory := repository.NewMockFactory(t)
	mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConfigRepo, nil)

	patcher := &capturePatcher{}

	rc := &RepositoryController{
		repoLister:    mockLister,
		quotaGetter:   quotas.NewFixedQuotaGetter(provisioning.QuotaStatus{}),
		quotaChecker:  NewRepositoryQuotaChecker(mockLister),
		healthChecker: healthChecker,
		repoFactory:   mockFactory,
		statusPatcher: patcher,
		logger:        logging.DefaultLogger,
	}

	err := rc.process(&queueItem{key: "default/test-repo"})
	require.NoError(t, err)

	// Find the last /status/conditions patch operation — if there are multiple
	// replace ops on the same path, the last one wins when applied as a JSON Patch.
	var lastConditionsPatch map[string]interface{}
	for _, op := range patcher.ops {
		if path, ok := op["path"].(string); ok && path == "/status/conditions" {
			lastConditionsPatch = op
		}
	}

	require.NotNil(t, lastConditionsPatch, "expected at least one /status/conditions patch")

	conditions, ok := lastConditionsPatch["value"].([]metav1.Condition)
	require.True(t, ok, "expected conditions value to be []metav1.Condition")

	var hasQuotaCondition, hasReadyCondition bool
	for _, c := range conditions {
		switch c.Type {
		case provisioning.ConditionTypeNamespaceQuota:
			hasQuotaCondition = true
		case provisioning.ConditionTypeReady:
			hasReadyCondition = true
		}
	}

	assert.True(t, hasQuotaCondition, "expected quota condition in final /status/conditions patch")
	assert.True(t, hasReadyCondition, "expected ready condition in final /status/conditions patch")
	assert.Len(t, conditions, 2, "expected exactly 2 conditions (quota + ready)")
}

// TestRepositoryController_process_TokenRefreshedWhileOverQuota verifies that auth token
// refresh is not skipped when a repository is blocked due to namespace quota being exceeded.
func TestRepositoryController_process_TokenRefreshedWhileOverQuota(t *testing.T) {
	namespace := "default"
	repoName := "test-repo"
	connName := "my-connection"
	resyncInterval := 5 * time.Minute

	// Token was created long ago (not recently created) and expires soon (within the
	// 2*resyncInterval+10s refresh buffer), so shouldGenerateTokenFromConnection returns true.
	expiration := time.Now().Add(30 * time.Second)
	lastUpdated := time.Now().Add(-1 * time.Hour)

	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       repoName,
			Namespace:  namespace,
			Generation: 1,
		},
		Spec: provisioning.RepositorySpec{
			Type:       provisioning.LocalRepositoryType,
			Sync:       provisioning.SyncOptions{Enabled: false},
			Connection: &provisioning.ConnectionInfo{Name: connName},
		},
		Status: provisioning.RepositoryStatus{
			// spec is already observed — no spec-change trigger
			ObservedGeneration: 1,
			Health: provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().UnixMilli(),
			},
			Token: provisioning.TokenStatus{
				LastUpdated: lastUpdated.UnixMilli(),
				Expiration:  expiration.UnixMilli(),
			},
			// Repository is CURRENTLY BLOCKED by namespace quota
			Conditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeNamespaceQuota,
					Status:             metav1.ConditionFalse,
					Reason:             provisioning.ReasonQuotaExceeded,
					Message:            "namespace quota exceeded: 2/1 repositories",
					LastTransitionTime: metav1.Now(),
				},
			},
		},
		// Existing (non-zero) token so IsZero() == false and we exercise the expiry path
		Secure: provisioning.SecureValues{
			Token: common.InlineSecureValue{Create: "old-expiring-token"},
		},
	}

	// A second repo in the same namespace keeps the namespace over quota (maxRepositories=1).
	repo2 := repo.DeepCopy()
	repo2.Name = "other-repo"

	indexer := cache.NewIndexer(
		cache.MetaNamespaceKeyFunc,
		cache.Indexers{cache.NamespaceIndex: cache.MetaNamespaceIndexFunc},
	)
	require.NoError(t, indexer.Add(repo))
	require.NoError(t, indexer.Add(repo2))
	repoLister := listers.NewRepositoryLister(indexer)

	// quotaGetter: maxRepositories=1 with 2 repos → still over quota (isOverQuota=true)
	quotaStatus := provisioning.QuotaStatus{MaxRepositories: 1}

	// Connection mock: GenerateRepositoryToken returns a fresh long-lived token
	freshToken := &connection.ExpirableSecureValue{
		Token:     "fresh-token",
		ExpiresAt: time.Now().Add(2 * time.Hour),
	}
	mockConn := connection.NewMockConnection(t)
	mockConn.EXPECT().GenerateRepositoryToken(mock.Anything, mock.Anything).Return(freshToken, nil).Once()

	mockConnFactory := connection.NewMockFactory(t)
	mockConnFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConn, nil).Once()

	// Client mock: Connections(namespace).Get returns the Connection object
	connObj := &provisioning.Connection{
		ObjectMeta: metav1.ObjectMeta{Name: connName, Namespace: namespace},
	}
	provClient := &mockProvisioningV0alpha1Interface{
		connectionsFunc: func(_ string) client.ConnectionInterface {
			return mockConnectionInterface{
				getFunc: func(_ context.Context, _ string, _ metav1.GetOptions) (*provisioning.Connection, error) {
					return connObj, nil
				},
			}
		},
	}

	// The repo factory and health checker are reached.
	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(repo).Maybe()
	mockRepo.On("Test", mock.Anything).Return(&provisioning.TestResults{Success: true}, nil).Maybe()

	repoFactory := repository.NewMockFactory(t)
	repoFactory.On("Build", mock.Anything, mock.Anything).Return(mockRepo, nil).Maybe()

	healthMetrics := NewMockHealthMetricsRecorder(t)
	healthMetrics.EXPECT().RecordHealthCheck(mock.Anything, mock.Anything, mock.Anything).Maybe()

	patcher := &capturePatcher{}
	tester := repository.NewTester()
	healthChecker := NewRepositoryHealthChecker(patcher, tester, healthMetrics)

	rc := &RepositoryController{
		repoLister:        repoLister,
		quotaGetter:       quotas.NewFixedQuotaGetter(quotaStatus),
		quotaChecker:      NewRepositoryQuotaChecker(repoLister),
		statusPatcher:     patcher,
		connectionFactory: mockConnFactory,
		client:            provClient,
		repoFactory:       repoFactory,
		healthChecker:     healthChecker,
		resyncInterval:    resyncInterval,
		logger:            logging.DefaultLogger.With("logger", loggerName),
	}

	err := rc.process(&queueItem{key: namespace + "/" + repoName})
	require.NoError(t, err)

	// The token patch must be present even though the repository is currently over quota.
	_, found := patcher.findPatchOp("/status/token")
	assert.True(t, found, "expected /status/token to be refreshed even when repository is quota-blocked")
}

func TestShouldRotateWebhookSecret(t *testing.T) {
	t.Run("returns false when rotation interval is zero (disabled)", func(t *testing.T) {
		rc := &RepositoryController{webhookSecretRotationInterval: 0}
		obj := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			},
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{ID: 123, LastRotated: 1},
			},
		}
		require.False(t, rc.shouldRotateWebhookSecret(obj))
	})

	t.Run("returns false when no workflows", func(t *testing.T) {
		rc := &RepositoryController{webhookSecretRotationInterval: 30 * 24 * time.Hour}
		obj := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Workflows: []provisioning.Workflow{},
			},
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{ID: 123, LastRotated: 1},
			},
		}
		require.False(t, rc.shouldRotateWebhookSecret(obj))
	})

	t.Run("returns false when no webhook", func(t *testing.T) {
		rc := &RepositoryController{webhookSecretRotationInterval: 30 * 24 * time.Hour}
		obj := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			},
		}
		require.False(t, rc.shouldRotateWebhookSecret(obj))
	})

	t.Run("returns false when webhook ID is zero", func(t *testing.T) {
		rc := &RepositoryController{webhookSecretRotationInterval: 30 * 24 * time.Hour}
		obj := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			},
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{ID: 0},
			},
		}
		require.False(t, rc.shouldRotateWebhookSecret(obj))
	})

	t.Run("returns true when LastRotated is zero (never rotated)", func(t *testing.T) {
		rc := &RepositoryController{webhookSecretRotationInterval: 30 * 24 * time.Hour}
		obj := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			},
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{ID: 123, LastRotated: 0},
			},
		}
		require.True(t, rc.shouldRotateWebhookSecret(obj))
	})

	t.Run("returns true when rotation interval has elapsed", func(t *testing.T) {
		rc := &RepositoryController{webhookSecretRotationInterval: 30 * 24 * time.Hour}
		expired := time.Now().Add(-31 * 24 * time.Hour).UnixMilli()
		obj := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			},
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{ID: 123, LastRotated: expired},
			},
		}
		require.True(t, rc.shouldRotateWebhookSecret(obj))
	})

	t.Run("returns false when rotation interval has not elapsed", func(t *testing.T) {
		rc := &RepositoryController{webhookSecretRotationInterval: 30 * 24 * time.Hour}
		recent := time.Now().Add(-1 * 24 * time.Hour).UnixMilli()
		obj := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			},
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{ID: 123, LastRotated: recent},
			},
		}
		require.False(t, rc.shouldRotateWebhookSecret(obj))
	})
}

// hookRepoStub implements repository.Repository and repository.Hooks so we can
// observe whether the reconcile path attempts to run webhook hooks.
//
// hookErr controls what OnCreate / OnUpdate return — when nil the hook is
// considered successful. The default zero-value preserves the historical
// behaviour of always failing with assert.AnError.
type hookRepoStub struct {
	cfg           *provisioning.Repository
	testCalls     atomic.Int32
	onUpdateCalls atomic.Int32
	onCreateCalls atomic.Int32
	hookErr       error
	hookErrSet    bool
}

func (s *hookRepoStub) Config() *provisioning.Repository { return s.cfg }

func (s *hookRepoStub) Test(ctx context.Context) (*provisioning.TestResults, error) {
	s.testCalls.Add(1)
	return &provisioning.TestResults{Success: true, Code: http.StatusOK}, nil
}

func (s *hookRepoStub) hookResult() error {
	if s.hookErrSet {
		return s.hookErr
	}
	return assert.AnError
}

func (s *hookRepoStub) OnCreate(ctx context.Context) ([]map[string]interface{}, error) {
	s.onCreateCalls.Add(1)
	return nil, s.hookResult()
}

func (s *hookRepoStub) OnUpdate(ctx context.Context) ([]map[string]interface{}, error) {
	s.onUpdateCalls.Add(1)
	return nil, s.hookResult()
}

func (s *hookRepoStub) OnDelete(ctx context.Context) error { return nil }

// TestRepositoryController_process_HookFailureCooldownSuppressesRetry verifies
// that while the hook-failure cooldown is still active, the reconcile loop does
// not re-run hooks and does not overwrite the recorded HealthFailureHook with
// a fresh health refresh (which would otherwise re-arm the webhook creation
// path on the very next reconcile).
func TestRepositoryController_process_HookFailureCooldownSuppressesRetry(t *testing.T) {
	namespace := "default"
	repoName := "test-repo"

	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       repoName,
			Namespace:  namespace,
			Generation: 1,
		},
		Spec: provisioning.RepositorySpec{
			Type:      provisioning.GitHubRepositoryType,
			Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			Sync:      provisioning.SyncOptions{Enabled: false},
		},
		Status: provisioning.RepositoryStatus{
			ObservedGeneration: 1,
			Health: provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHook,
				Checked: time.Now().UnixMilli(),
				Message: []string{"failed to create webhook"},
			},
		},
	}

	indexer := cache.NewIndexer(
		cache.MetaNamespaceKeyFunc,
		cache.Indexers{cache.NamespaceIndex: cache.MetaNamespaceIndexFunc},
	)
	require.NoError(t, indexer.Add(repo))
	repoLister := listers.NewRepositoryLister(indexer)

	patcher := &capturePatcher{}

	healthMetrics := NewMockHealthMetricsRecorder(t)
	healthMetrics.EXPECT().
		RecordHealthCheck(mock.Anything, mock.Anything, mock.Anything).
		Maybe()

	tester := repository.NewTester()
	healthChecker := NewRepositoryHealthChecker(patcher, tester, healthMetrics)

	stub := &hookRepoStub{cfg: repo}
	repoFactory := repository.NewMockFactory(t)
	repoFactory.On("Build", mock.Anything, mock.Anything).Return(stub, nil).Maybe()

	mockJobs := &mockJobsQueueStore{
		MockQueue: jobs.NewMockQueue(t),
		MockStore: jobs.NewMockStore(t),
	}

	rc := &RepositoryController{
		repoLister:    repoLister,
		quotaGetter:   quotas.NewFixedQuotaGetter(provisioning.QuotaStatus{}),
		quotaChecker:  NewRepositoryQuotaChecker(repoLister),
		healthChecker: healthChecker,
		statusPatcher: patcher,
		repoFactory:   repoFactory,
		jobs:          mockJobs,
		logger:        logging.DefaultLogger.With("logger", loggerName),
		tracer:        tracing.InitializeTracerForTest(),
	}

	err := rc.process(&queueItem{key: namespace + "/" + repoName})
	require.NoError(t, err)

	assert.Equal(t, int32(0), stub.onUpdateCalls.Load(),
		"hooks must not be re-run while the hook failure cooldown is active")
	assert.Equal(t, int32(0), stub.onCreateCalls.Load(),
		"hooks must not be re-run while the hook failure cooldown is active")
	assert.Equal(t, int32(0), stub.testCalls.Load(),
		"health refresh must be skipped while the hook failure cooldown is active")

	_, healthPatched := patcher.findPatchOp("/status/health")
	assert.False(t, healthPatched,
		"existing HealthFailureHook status must not be overwritten during cooldown")
}

// newRecoveryController is a small helper that wires up the minimal set of
// dependencies required to drive RepositoryController.process for the
// HealthFailureHook recovery scenarios below.
func newRecoveryController(t *testing.T, repo *provisioning.Repository, stub *hookRepoStub) (*RepositoryController, *capturePatcher) {
	t.Helper()

	indexer := cache.NewIndexer(
		cache.MetaNamespaceKeyFunc,
		cache.Indexers{cache.NamespaceIndex: cache.MetaNamespaceIndexFunc},
	)
	require.NoError(t, indexer.Add(repo))
	repoLister := listers.NewRepositoryLister(indexer)

	patcher := &capturePatcher{}

	healthMetrics := NewMockHealthMetricsRecorder(t)
	healthMetrics.EXPECT().
		RecordHealthCheck(mock.Anything, mock.Anything, mock.Anything).
		Maybe()

	tester := repository.NewTester()
	healthChecker := NewRepositoryHealthChecker(patcher, tester, healthMetrics)

	repoFactory := repository.NewMockFactory(t)
	repoFactory.On("Build", mock.Anything, mock.Anything).Return(stub, nil).Maybe()

	mockJobs := &mockJobsQueueStore{
		MockQueue: jobs.NewMockQueue(t),
		MockStore: jobs.NewMockStore(t),
	}

	rc := &RepositoryController{
		repoLister:    repoLister,
		quotaGetter:   quotas.NewFixedQuotaGetter(provisioning.QuotaStatus{}),
		quotaChecker:  NewRepositoryQuotaChecker(repoLister),
		healthChecker: healthChecker,
		statusPatcher: patcher,
		repoFactory:   repoFactory,
		jobs:          mockJobs,
		logger:        logging.DefaultLogger.With("logger", loggerName),
		tracer:        tracing.InitializeTracerForTest(),
	}
	return rc, patcher
}

// TestRepositoryController_process_HookFailureRecoveryAfterWorkflowsRemoved
// verifies that updating the spec to remove the workflows that required a
// webhook bypasses the hook-failure cooldown so the repository can recover
// instead of getting stuck unhealthy indefinitely.
//
// Scenario: the repository previously failed webhook setup and is in the
// HealthFailureHook cooldown. The user edits the spec to remove all workflows
// (incrementing Generation). Without the requiresWebhook gate the cooldown
// would suppress the health refresh AND ShouldCheckHealth would permanently
// skip future checks because Health.Error stays HealthFailureHook even after
// observedGeneration catches up with Generation.
func TestRepositoryController_process_HookFailureRecoveryAfterWorkflowsRemoved(t *testing.T) {
	namespace := "default"
	repoName := "test-repo"

	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       repoName,
			Namespace:  namespace,
			Generation: 2,
		},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
			// User just removed write workflows — no webhook is required anymore.
			Workflows: nil,
			Sync:      provisioning.SyncOptions{Enabled: false},
		},
		Status: provisioning.RepositoryStatus{
			ObservedGeneration: 1,
			Health: provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHook,
				// Recent failure — cooldown is still active.
				Checked: time.Now().UnixMilli(),
				Message: []string{"failed to create webhook"},
			},
		},
	}

	stub := &hookRepoStub{
		cfg:        repo,
		hookErr:    nil,
		hookErrSet: true,
	}
	rc, patcher := newRecoveryController(t, repo, stub)

	require.NoError(t, rc.process(&queueItem{key: namespace + "/" + repoName}))

	assert.Equal(t, int32(1), stub.testCalls.Load(),
		"health refresh must run after workflows are removed even during the previous cooldown")

	healthOp, healthPatched := patcher.findPatchOp("/status/health")
	require.True(t, healthPatched,
		"expected /status/health to be patched once the spec no longer requires a webhook")
	healthStatus, ok := healthOp["value"].(provisioning.HealthStatus)
	require.True(t, ok, "expected /status/health value to be HealthStatus")
	assert.True(t, healthStatus.Healthy,
		"repository must recover to healthy now that the hook-failure cooldown no longer applies")
	assert.Empty(t, healthStatus.Error,
		"recovered health status must clear HealthFailureHook")

	obsOp, obsPatched := patcher.findPatchOp("/status/observedGeneration")
	require.True(t, obsPatched, "expected observedGeneration to advance with the spec change")
	assert.EqualValues(t, repo.Generation, obsOp["value"])
}

// TestRepositoryController_process_HookFailureRecoveryAfterCooldownExpires
// verifies that ShouldCheckHealth no longer permanently skips health checks
// for HealthFailureHook once the cooldown window has elapsed. Without the fix,
// Status.Health.Error == HealthFailureHook would short-circuit ShouldCheckHealth
// forever, leaving the repository stuck unhealthy after a transient webhook
// outage even when the underlying connection has recovered.
func TestRepositoryController_process_HookFailureRecoveryAfterCooldownExpires(t *testing.T) {
	namespace := "default"
	repoName := "test-repo"

	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       repoName,
			Namespace:  namespace,
			Generation: 1,
		},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
			// Webhook is still required by the spec — the recovery here is purely
			// driven by the cooldown window expiring rather than by a spec edit.
			Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			Sync:      provisioning.SyncOptions{Enabled: false},
		},
		Status: provisioning.RepositoryStatus{
			ObservedGeneration: 1,
			Webhook: &provisioning.WebhookStatus{
				ID: 42, // Webhook already exists — webhookMissing is false.
			},
			Health: provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHook,
				// Older than recentUnhealthyDuration (1 minute) so the cooldown
				// is no longer active.
				Checked: time.Now().Add(-2 * time.Minute).UnixMilli(),
				Message: []string{"failed to create webhook"},
			},
		},
	}

	stub := &hookRepoStub{cfg: repo}
	rc, patcher := newRecoveryController(t, repo, stub)

	require.NoError(t, rc.process(&queueItem{key: namespace + "/" + repoName}))

	assert.Equal(t, int32(0), stub.onCreateCalls.Load(),
		"hooks must not run when the spec is observed and the webhook already exists")
	assert.Equal(t, int32(0), stub.onUpdateCalls.Load(),
		"hooks must not run when the spec is observed and the webhook already exists")
	assert.Equal(t, int32(1), stub.testCalls.Load(),
		"health refresh must run once the hook-failure cooldown window has elapsed")

	healthOp, healthPatched := patcher.findPatchOp("/status/health")
	require.True(t, healthPatched,
		"expected /status/health to be patched once the cooldown expires")
	healthStatus, ok := healthOp["value"].(provisioning.HealthStatus)
	require.True(t, ok, "expected /status/health value to be HealthStatus")
	assert.True(t, healthStatus.Healthy,
		"repository must recover after the hook-failure cooldown elapses")
	assert.Empty(t, healthStatus.Error,
		"recovered health status must clear HealthFailureHook")
}
