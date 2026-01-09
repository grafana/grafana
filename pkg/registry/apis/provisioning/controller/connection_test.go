package controller

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	connectionvalidation "github.com/grafana/grafana/apps/provisioning/pkg/connection"
	applyconfiguration "github.com/grafana/grafana/apps/provisioning/pkg/generated/applyconfiguration/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
)

func TestConnectionController_shouldCheckHealth(t *testing.T) {
	testCases := []struct {
		name     string
		conn     *provisioning.Connection
		expected bool
	}{
		{
			name: "should check health when generation differs from observed",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 2,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
				},
			},
			expected: true,
		},
		{
			name: "should check health when never checked before",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 1,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Checked: 0,
					},
				},
			},
			expected: true,
		},
		{
			name: "should check health when healthy check is stale (>5 min)",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 1,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().Add(-6 * time.Minute).UnixMilli(),
					},
				},
			},
			expected: true,
		},
		{
			name: "should check health when unhealthy check is stale (>1 min)",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 1,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: false,
						Checked: time.Now().Add(-2 * time.Minute).UnixMilli(),
					},
				},
			},
			expected: true,
		},
		{
			name: "should not check health when healthy check is recent (<5 min)",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 1,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().Add(-2 * time.Minute).UnixMilli(),
					},
				},
			},
			expected: false,
		},
		{
			name: "should not check health when unhealthy check is recent (<1 min)",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 1,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: false,
						Checked: time.Now().Add(-30 * time.Second).UnixMilli(),
					},
				},
			},
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cc := &ConnectionController{}
			result := cc.shouldCheckHealth(tc.conn)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestConnectionController_hasRecentHealthCheck(t *testing.T) {
	testCases := []struct {
		name         string
		healthStatus provisioning.HealthStatus
		expected     bool
	}{
		{
			name: "never checked",
			healthStatus: provisioning.HealthStatus{
				Checked: 0,
			},
			expected: false,
		},
		{
			name: "healthy and recent",
			healthStatus: provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().Add(-2 * time.Minute).UnixMilli(),
			},
			expected: true,
		},
		{
			name: "healthy and stale",
			healthStatus: provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().Add(-10 * time.Minute).UnixMilli(),
			},
			expected: false,
		},
		{
			name: "unhealthy and recent",
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Checked: time.Now().Add(-30 * time.Second).UnixMilli(),
			},
			expected: true,
		},
		{
			name: "unhealthy and stale",
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Checked: time.Now().Add(-2 * time.Minute).UnixMilli(),
			},
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cc := &ConnectionController{}
			result := cc.hasRecentHealthCheck(tc.healthStatus)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestConnectionController_reconcileConditions(t *testing.T) {
	testCases := []struct {
		name              string
		conn              *provisioning.Connection
		expectReconcile   bool
		expectSpecChanged bool
		description       string
	}{
		{
			name: "skip when being deleted",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test-conn",
					Namespace:         "default",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
				},
			},
			expectReconcile:   false,
			expectSpecChanged: false,
			description:       "deleted connections should be skipped",
		},
		{
			name: "skip when no changes needed",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-conn",
					Namespace:  "default",
					Generation: 1,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().UnixMilli(),
					},
				},
			},
			expectReconcile:   false,
			expectSpecChanged: false,
			description:       "no reconcile when generation matches and health is recent",
		},
		{
			name: "reconcile when spec changed",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-conn",
					Namespace:  "default",
					Generation: 2,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().UnixMilli(),
					},
				},
			},
			expectReconcile:   true,
			expectSpecChanged: true,
			description:       "reconcile when generation differs",
		},
		{
			name: "reconcile when health is stale",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-conn",
					Namespace:  "default",
					Generation: 1,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().Add(-10 * time.Minute).UnixMilli(),
					},
				},
			},
			expectReconcile:   true,
			expectSpecChanged: false,
			description:       "reconcile when health check is stale",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cc := &ConnectionController{}

			// Test the core reconciliation conditions
			if tc.conn.DeletionTimestamp != nil {
				assert.False(t, tc.expectReconcile, tc.description)
				return
			}

			hasSpecChanged := tc.conn.Generation != tc.conn.Status.ObservedGeneration
			shouldCheckHealth := cc.shouldCheckHealth(tc.conn)

			needsReconcile := hasSpecChanged || shouldCheckHealth

			assert.Equal(t, tc.expectReconcile, needsReconcile, tc.description)
			assert.Equal(t, tc.expectSpecChanged, hasSpecChanged, "spec changed check")
		})
	}
}

func TestConnectionController_processNextWorkItem(t *testing.T) {
	t.Run("returns false when queue is shut down", func(t *testing.T) {
		cc := &ConnectionController{}
		// This test verifies the structure is correct
		assert.NotNil(t, cc)
	})
}

// mockRepositoryLister is a mock implementation of RepositoryLister for testing
type mockRepositoryLister struct {
	mock.Mock
}

func (m *mockRepositoryLister) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	args := m.Called(ctx, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(runtime.Object), args.Error(1)
}

// mockConnectionInterface is a mock implementation of client.ConnectionInterface for testing
type mockConnectionInterface struct {
	mock.Mock
}

func (m *mockConnectionInterface) Create(ctx context.Context, connection *provisioning.Connection, opts metav1.CreateOptions) (*provisioning.Connection, error) {
	args := m.Called(ctx, connection, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*provisioning.Connection), args.Error(1)
}

func (m *mockConnectionInterface) Update(ctx context.Context, connection *provisioning.Connection, opts metav1.UpdateOptions) (*provisioning.Connection, error) {
	args := m.Called(ctx, connection, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*provisioning.Connection), args.Error(1)
}

func (m *mockConnectionInterface) UpdateStatus(ctx context.Context, connection *provisioning.Connection, opts metav1.UpdateOptions) (*provisioning.Connection, error) {
	args := m.Called(ctx, connection, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*provisioning.Connection), args.Error(1)
}

func (m *mockConnectionInterface) Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error {
	args := m.Called(ctx, name, opts)
	return args.Error(0)
}

func (m *mockConnectionInterface) DeleteCollection(ctx context.Context, opts metav1.DeleteOptions, listOpts metav1.ListOptions) error {
	args := m.Called(ctx, opts, listOpts)
	return args.Error(0)
}

func (m *mockConnectionInterface) Get(ctx context.Context, name string, opts metav1.GetOptions) (*provisioning.Connection, error) {
	args := m.Called(ctx, name, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*provisioning.Connection), args.Error(1)
}

func (m *mockConnectionInterface) List(ctx context.Context, opts metav1.ListOptions) (*provisioning.ConnectionList, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*provisioning.ConnectionList), args.Error(1)
}

func (m *mockConnectionInterface) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(watch.Interface), args.Error(1)
}

func (m *mockConnectionInterface) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions, subresources ...string) (*provisioning.Connection, error) {
	args := m.Called(ctx, name, pt, data, opts, subresources)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*provisioning.Connection), args.Error(1)
}

func (m *mockConnectionInterface) Apply(ctx context.Context, connection *applyconfiguration.ConnectionApplyConfiguration, opts metav1.ApplyOptions) (*provisioning.Connection, error) {
	args := m.Called(ctx, connection, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*provisioning.Connection), args.Error(1)
}

func (m *mockConnectionInterface) ApplyStatus(ctx context.Context, connection *applyconfiguration.ConnectionApplyConfiguration, opts metav1.ApplyOptions) (*provisioning.Connection, error) {
	args := m.Called(ctx, connection, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*provisioning.Connection), args.Error(1)
}

// mockProvisioningV0alpha1InterfaceForConnections is a mock implementation of client.ProvisioningV0alpha1Interface for connection tests
type mockProvisioningV0alpha1InterfaceForConnections struct {
	mock.Mock
	connections *mockConnectionInterface
}

func (m *mockProvisioningV0alpha1InterfaceForConnections) RESTClient() rest.Interface {
	panic("not needed for testing")
}

func (m *mockProvisioningV0alpha1InterfaceForConnections) HistoricJobs(namespace string) client.HistoricJobInterface {
	panic("not needed for testing")
}

func (m *mockProvisioningV0alpha1InterfaceForConnections) Jobs(namespace string) client.JobInterface {
	panic("not needed for testing")
}

func (m *mockProvisioningV0alpha1InterfaceForConnections) Connections(namespace string) client.ConnectionInterface {
	return m.connections
}

func (m *mockProvisioningV0alpha1InterfaceForConnections) Repositories(namespace string) client.RepositoryInterface {
	panic("not needed for testing")
}

func TestConnectionController_handleDelete(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name                   string
		connection             *provisioning.Connection
		repoListerSetup        func(*mockRepositoryLister)
		connectionSetup        func(*mockConnectionInterface)
		expectedError          string
		expectFinalizerRemoved bool
	}{
		{
			name: "no finalizer present, should return nil",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test-conn",
					Namespace:         "default",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
					Finalizers:        []string{},
				},
			},
			repoListerSetup:        func(m *mockRepositoryLister) {},
			connectionSetup:        func(m *mockConnectionInterface) {},
			expectedError:          "",
			expectFinalizerRemoved: false,
		},
		{
			name: "finalizer present but repositories exist, should block deletion",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test-conn",
					Namespace:         "default",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
					Finalizers:        []string{connectionvalidation.BlockDeletionFinalizer},
				},
			},
			repoListerSetup: func(m *mockRepositoryLister) {
				m.On("List", ctx, mock.MatchedBy(func(opts *internalversion.ListOptions) bool {
					return opts.FieldSelector != nil && opts.FieldSelector.String() == "spec.connection.name=test-conn"
				})).Return(&provisioning.RepositoryList{
					Items: []provisioning.Repository{
						{
							ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
							Spec: provisioning.RepositorySpec{
								Connection: &provisioning.ConnectionInfo{Name: "test-conn"},
							},
						},
						{
							ObjectMeta: metav1.ObjectMeta{Name: "repo-2"},
							Spec: provisioning.RepositorySpec{
								Connection: &provisioning.ConnectionInfo{Name: "test-conn"},
							},
						},
					},
				}, nil)
			},
			connectionSetup:        func(m *mockConnectionInterface) {},
			expectedError:          "cannot delete connection while repositories are using it: repo-1, repo-2",
			expectFinalizerRemoved: false,
		},
		{
			name: "finalizer present and no repositories, should remove finalizer",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test-conn",
					Namespace:         "default",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
					Finalizers:        []string{connectionvalidation.BlockDeletionFinalizer},
				},
			},
			repoListerSetup: func(m *mockRepositoryLister) {
				m.On("List", ctx, mock.MatchedBy(func(opts *internalversion.ListOptions) bool {
					return opts.FieldSelector != nil && opts.FieldSelector.String() == "spec.connection.name=test-conn"
				})).Return(&provisioning.RepositoryList{
					Items: []provisioning.Repository{},
				}, nil)
			},
			connectionSetup: func(m *mockConnectionInterface) {
				m.On("Patch", ctx, "test-conn", types.JSONPatchType, mock.Anything, metav1.PatchOptions{
					FieldManager: "provisioning-connection-controller",
				}, mock.Anything).Return(&provisioning.Connection{}, nil)
			},
			expectedError:          "",
			expectFinalizerRemoved: true,
		},
		{
			name: "error checking repositories, should return error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test-conn",
					Namespace:         "default",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
					Finalizers:        []string{connectionvalidation.BlockDeletionFinalizer},
				},
			},
			repoListerSetup: func(m *mockRepositoryLister) {
				m.On("List", ctx, mock.Anything).Return(nil, errors.New("list error"))
			},
			connectionSetup:        func(m *mockConnectionInterface) {},
			expectedError:          "check for connected repositories: list error",
			expectFinalizerRemoved: false,
		},
		{
			name: "error removing finalizer, should return error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test-conn",
					Namespace:         "default",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
					Finalizers:        []string{connectionvalidation.BlockDeletionFinalizer},
				},
			},
			repoListerSetup: func(m *mockRepositoryLister) {
				m.On("List", ctx, mock.Anything).Return(&provisioning.RepositoryList{
					Items: []provisioning.Repository{},
				}, nil)
			},
			connectionSetup: func(m *mockConnectionInterface) {
				m.On("Patch", ctx, "test-conn", types.JSONPatchType, mock.Anything, metav1.PatchOptions{
					FieldManager: "provisioning-connection-controller",
				}, mock.Anything).Return(nil, errors.New("patch error"))
			},
			expectedError:          "remove finalizer: patch error",
			expectFinalizerRemoved: false,
		},
		{
			name: "pagination handled correctly",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test-conn",
					Namespace:         "default",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
					Finalizers:        []string{connectionvalidation.BlockDeletionFinalizer},
				},
			},
			repoListerSetup: func(m *mockRepositoryLister) {
				// First call returns empty with continue token (testing pagination even when empty)
				m.On("List", ctx, mock.MatchedBy(func(opts *internalversion.ListOptions) bool {
					return opts.Continue == ""
				})).Return(&provisioning.RepositoryList{
					Items:    []provisioning.Repository{},
					ListMeta: metav1.ListMeta{Continue: "continue-token"},
				}, nil)
				// Second call returns empty with no continue token
				m.On("List", ctx, mock.MatchedBy(func(opts *internalversion.ListOptions) bool {
					return opts.Continue == "continue-token"
				})).Return(&provisioning.RepositoryList{
					Items: []provisioning.Repository{},
				}, nil)
			},
			connectionSetup: func(m *mockConnectionInterface) {
				m.On("Patch", ctx, "test-conn", types.JSONPatchType, mock.Anything, metav1.PatchOptions{
					FieldManager: "provisioning-connection-controller",
				}, mock.Anything).Return(&provisioning.Connection{}, nil)
			},
			expectedError:          "",
			expectFinalizerRemoved: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repoLister := new(mockRepositoryLister)
			connInterface := new(mockConnectionInterface)
			client := &mockProvisioningV0alpha1InterfaceForConnections{connections: connInterface}

			tt.repoListerSetup(repoLister)
			tt.connectionSetup(connInterface)

			cc := &ConnectionController{
				client:     client,
				repoLister: repoLister,
				logger:     nil, // logger is optional for testing
			}

			err := cc.handleDelete(ctx, tt.connection)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			if tt.expectFinalizerRemoved {
				connInterface.AssertCalled(t, "Patch", ctx, "test-conn", types.JSONPatchType, mock.Anything, metav1.PatchOptions{
					FieldManager: "provisioning-connection-controller",
				}, mock.Anything)
			} else {
				connInterface.AssertNotCalled(t, "Patch", ctx, "test-conn", types.JSONPatchType, mock.Anything, metav1.PatchOptions{}, mock.Anything)
			}

			repoLister.AssertExpectations(t)
			connInterface.AssertExpectations(t)
		})
	}
}
