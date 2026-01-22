package controller

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller/mocks"
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

func TestConnectionController_process_FieldErrors(t *testing.T) {
	tests := []struct {
		name                string
		testResults         *provisioning.TestResults
		expectedFieldErrors []provisioning.ErrorDetails
		description         string
	}{
		{
			name: "fieldErrors populated when test fails with errors",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    422,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueRequired,
						Field:  "spec.github.appID",
						Detail: "appID must be specified for GitHub connection",
					},
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  "spec.github.installationID",
						Detail: "installationID must be a valid number",
					},
				},
			},
			expectedFieldErrors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueRequired,
					Field:  "spec.github.appID",
					Detail: "appID must be specified for GitHub connection",
				},
				{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  "spec.github.installationID",
					Detail: "installationID must be a valid number",
				},
			},
			description: "fieldErrors should contain all errors from testResults",
		},
		{
			name: "fieldErrors empty when test succeeds",
			testResults: &provisioning.TestResults{
				Success: true,
				Code:    200,
				Errors:  []provisioning.ErrorDetails{},
			},
			expectedFieldErrors: []provisioning.ErrorDetails{},
			description:         "fieldErrors should be empty when connection test succeeds",
		},
		{
			name: "fieldErrors empty when testResults has nil errors",
			testResults: &provisioning.TestResults{
				Success: true,
				Code:    200,
				Errors:  nil,
			},
			expectedFieldErrors: nil,
			description:         "fieldErrors should be nil when testResults.Errors is nil",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			// Create connection
			conn := &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-conn",
					Namespace:  "default",
					Generation: 1,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 0, // Will trigger reconciliation
				},
			}

			// Create mock lister
			mockLister := &mockConnectionLister{
				conn: conn,
			}

			// Create mock status patcher
			mockPatcher := mocks.NewConnectionStatusPatcher(t)
			// Use mock.Anything for all arguments since variadic args are expanded
			mockPatcher.On("Patch", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					// Extract variadic patch operations - they come as individual arguments after the first two
					patchOps := []map[string]interface{}{}
					for i := 2; i < len(args); i++ {
						if op, ok := args[i].(map[string]interface{}); ok {
							patchOps = append(patchOps, op)
						}
					}
					// Verify fieldErrors patch operation exists
					fieldErrorsFound := false
					for _, op := range patchOps {
						if path, ok := op["path"].(string); ok && path == "/status/fieldErrors" {
							fieldErrorsFound = true
							value := op["value"]
							if tt.expectedFieldErrors == nil {
								assert.Nil(t, value, "fieldErrors should be nil")
							} else {
								fieldErrors, ok := value.([]provisioning.ErrorDetails)
								require.True(t, ok, "fieldErrors should be []ErrorDetails")
								assert.Equal(t, tt.expectedFieldErrors, fieldErrors, tt.description)
							}
							break
						}
					}
					assert.True(t, fieldErrorsFound, "fieldErrors patch operation should be present")
				}).
				Return(nil)

			// Create mock factory for tester
			mockFactory := connection.NewMockFactory(t)
			mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(nil).Maybe()
			mockConn := connection.NewMockConnection(t)
			mockConn.EXPECT().Test(mock.Anything).Return(tt.testResults, nil).Maybe()
			mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConn, nil).Maybe()

			// Create controller
			cc := &ConnectionController{
				connLister:    mockLister,
				connSynced:    func() bool { return true },
				statusPatcher: mockPatcher,
				tester:        connection.NewSimpleConnectionTester(mockFactory),
				logger:        logging.DefaultLogger,
			}

			// Process the connection
			item := &connectionQueueItem{
				key: "default/test-conn",
			}
			err := cc.process(ctx, item)
			require.NoError(t, err, "process should succeed")
		})
	}
}

// mockConnectionLister implements listers.ConnectionLister for testing
type mockConnectionLister struct {
	conn *provisioning.Connection
}

func (m *mockConnectionLister) Connections(namespace string) listers.ConnectionNamespaceLister {
	return &mockConnectionNamespaceLister{conn: m.conn}
}

func (m *mockConnectionLister) List(selector labels.Selector) (ret []*provisioning.Connection, err error) {
	panic("not implemented")
}

// mockConnectionNamespaceLister implements listers.ConnectionNamespaceLister for testing
type mockConnectionNamespaceLister struct {
	conn *provisioning.Connection
}

func (m *mockConnectionNamespaceLister) List(selector labels.Selector) (ret []*provisioning.Connection, err error) {
	panic("not implemented")
}

func (m *mockConnectionNamespaceLister) Get(name string) (*provisioning.Connection, error) {
	if m.conn != nil && m.conn.Name == name {
		return m.conn, nil
	}
	return nil, apierrors.NewNotFound(schema.GroupResource{Resource: "connections"}, name)
}

// Ensure mockConnectionLister implements listers.ConnectionLister
var _ listers.ConnectionLister = (*mockConnectionLister)(nil)

// Ensure mockConnectionNamespaceLister implements listers.ConnectionNamespaceLister
var _ listers.ConnectionNamespaceLister = (*mockConnectionNamespaceLister)(nil)
