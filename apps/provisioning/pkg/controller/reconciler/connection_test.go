package reconciler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
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
	"github.com/grafana/grafana/apps/provisioning/pkg/controller/reconciler/mocks"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/informer"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

type mockConnectionWithToken struct {
	connection.Connection
	connection.TokenConnection
}

func TestConnectionController_process(t *testing.T) {
	testCases := []struct {
		name          string
		setupMocks    func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory)
		conn          *provisioning.Connection
		expectError   bool
		errorContains string
	}{
		{
			name: "deletion timestamp - skip without error",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
					conn: &provisioning.Connection{
						ObjectMeta: metav1.ObjectMeta{
							Name:              "test-conn",
							Namespace:         "default",
							DeletionTimestamp: &metav1.Time{Time: time.Now()},
						},
					},
				}
				return mockLister, nil, nil, nil
			},
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test-conn",
					Namespace:         "default",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
				},
			},
			expectError: false,
		},
		{
			name: "no reconcile needed",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
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
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.IsType(&provisioning.Connection{})).Return(false)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)
				// Build is called before checking if reconciliation is needed, so we need to provide a mock
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnection, nil)
				return mockLister, mockHealthChecker, nil, mockFactory
			},
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
			expectError: false,
		},
		{
			name: "spec changed - full reconciliation",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
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
								Checked: time.Now().Add(-10 * time.Minute).UnixMilli(),
							},
						},
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
							GitHub: &provisioning.GitHubConnectionConfig{
								AppID:          "123",
								InstallationID: "456",
							},
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)

				testResults := &provisioning.TestResults{
					Success: true,
					Code:    http.StatusOK,
				}
				healthStatus := provisioning.HealthStatus{
					Healthy: true,
					Checked: time.Now().UnixMilli(),
				}

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnection, nil)
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(ConnectionHealthResultWithPatchOps{
						TestResults:  testResults,
						HealthStatus: healthStatus,
						PatchOps: []map[string]interface{}{
							{"op": "replace", "path": "/status/health", "value": healthStatus},
						},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory
			},
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
						Checked: time.Now().Add(-10 * time.Minute).UnixMilli(),
					},
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
			},
			expectError: false,
		},
		{
			name: "unhealthy with token regeneration",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
					conn: &provisioning.Connection{
						ObjectMeta: metav1.ObjectMeta{
							Name:       "test-conn",
							Namespace:  "default",
							Generation: 1,
						},
						Status: provisioning.ConnectionStatus{
							ObservedGeneration: 1,
							Health: provisioning.HealthStatus{
								Healthy: false,
								Checked: time.Now().Add(-2 * time.Minute).UnixMilli(),
								Error:   provisioning.HealthFailureHealth,
							},
						},
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
							GitHub: &provisioning.GitHubConnectionConfig{
								AppID:          "123",
								InstallationID: "456",
							},
						},
						Secure: provisioning.ConnectionSecure{
							Token: common.InlineSecureValue{
								Name: "existing-token",
							},
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)
				mockTokenConnection := connection.NewMockTokenConnection(t)
				mockConnWithToken := &mockConnectionWithToken{
					Connection:      mockConnection,
					TokenConnection: mockTokenConnection,
				}

				testResults := &provisioning.TestResults{
					Success: false,
					Code:    http.StatusBadRequest,
					Errors:  []provisioning.ErrorDetails{{Detail: "connection failed"}},
				}
				healthStatus := provisioning.HealthStatus{
					Healthy: false,
					Checked: time.Now().UnixMilli(),
					Error:   provisioning.HealthFailureHealth,
					Message: []string{"connection failed"},
				}

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnWithToken, nil)
				// Token expires in 2 minutes - should trigger regeneration
				mockTokenConnection.EXPECT().ValidateToken().Return(time.Now().Add(2*time.Minute), nil)
				mockTokenConnection.EXPECT().GenerateConnectionToken(mock.Anything).Return(&connection.ExpirableSecureValue{Token: "new-token"}, nil)
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(ConnectionHealthResultWithPatchOps{
						TestResults:  testResults,
						HealthStatus: healthStatus,
						PatchOps: []map[string]interface{}{
							{"op": "replace", "path": "/status/health", "value": healthStatus},
						},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory
			},
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-conn",
					Namespace:  "default",
					Generation: 1,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: false,
						Checked: time.Now().Add(-2 * time.Minute).UnixMilli(),
						Error:   provisioning.HealthFailureHealth,
					},
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Name: "existing-token",
					},
				},
			},
			expectError: false,
		},
		{
			name: "token not expired and not regenerated as it's new",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
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
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
						},
						Secure: provisioning.ConnectionSecure{
							Token: common.InlineSecureValue{
								Name: "existing-token",
							},
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)
				mockTokenConnection := connection.NewMockTokenConnection(t)
				mockConnWithToken := &mockConnectionWithToken{
					Connection:      mockConnection,
					TokenConnection: mockTokenConnection,
				}

				testResults := &provisioning.TestResults{
					Success: true,
					Code:    http.StatusOK,
				}
				healthStatus := provisioning.HealthStatus{
					Healthy: true,
					Checked: time.Now().UnixMilli(),
				}

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnWithToken, nil)
				// Token was written very recently (see the fixture's status), so no
				// refresh should happen.
				mockTokenConnection.EXPECT().ValidateToken().Return(time.Now().Add(2*time.Hour), nil)
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(ConnectionHealthResultWithPatchOps{
						TestResults:  testResults,
						HealthStatus: healthStatus,
						PatchOps: []map[string]interface{}{
							{"op": "replace", "path": "/status/health", "value": healthStatus},
						},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Run(
					func(ctx context.Context, conn *provisioning.Connection, patchOperations ...map[string]interface{}) {
						found := false
						for _, op := range patchOperations {
							if op["op"].(string) == "replace" &&
								op["path"].(string) == "/secure/token" &&
								op["value"].(map[string]string)["create"] == "someToken" {
								found = true
							}
						}
						require.False(t, found)
					},
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory
			},
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
					Token: provisioning.TokenStatus{
						LastUpdated: time.Now().Add(-8 * time.Second).UnixMilli(),
					},
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Name: "existing-token",
					},
				},
			},
			expectError: false,
		},
		{
			name: "token not expired and not regenerated",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
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
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
						},
						Secure: provisioning.ConnectionSecure{
							Token: common.InlineSecureValue{
								Name: "existing-token",
							},
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)
				mockTokenConnection := connection.NewMockTokenConnection(t)
				mockConnWithToken := &mockConnectionWithToken{
					Connection:      mockConnection,
					TokenConnection: mockTokenConnection,
				}

				testResults := &provisioning.TestResults{
					Success: true,
					Code:    http.StatusOK,
				}
				healthStatus := provisioning.HealthStatus{
					Healthy: true,
					Checked: time.Now().UnixMilli(),
				}

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnWithToken, nil)
				// Token expires in 15 minutes - with buffer of 10m10s (2*5m + 10s), this will NOT trigger regeneration
				mockTokenConnection.EXPECT().ValidateToken().Return(time.Now().Add(15*time.Minute), nil)
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(ConnectionHealthResultWithPatchOps{
						TestResults:  testResults,
						HealthStatus: healthStatus,
						PatchOps: []map[string]interface{}{
							{"op": "replace", "path": "/status/health", "value": healthStatus},
						},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Run(
					func(ctx context.Context, conn *provisioning.Connection, patchOperations ...map[string]interface{}) {
						found := false
						for _, op := range patchOperations {
							if op["op"].(string) == "replace" &&
								op["path"].(string) == "/secure/token" &&
								op["value"].(map[string]string)["create"] == "someToken" {
								found = true
							}
						}
						require.False(t, found)
					},
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory
			},
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
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Name: "existing-token",
					},
				},
			},
			expectError: false,
		},
		{
			name: "token not expired but regenerated",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
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
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
						},
						Secure: provisioning.ConnectionSecure{
							Token: common.InlineSecureValue{
								Name: "existing-token",
							},
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)
				mockTokenConnection := connection.NewMockTokenConnection(t)
				mockConnWithToken := &mockConnectionWithToken{
					Connection:      mockConnection,
					TokenConnection: mockTokenConnection,
				}

				testResults := &provisioning.TestResults{
					Success: true,
					Code:    http.StatusOK,
				}
				healthStatus := provisioning.HealthStatus{
					Healthy: true,
					Checked: time.Now().UnixMilli(),
				}

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnWithToken, nil)
				// Token expires in 9 minutes - with buffer of 10m10s (2*5m + 10s), this WILL trigger regeneration
				mockTokenConnection.EXPECT().ValidateToken().Return(time.Now().Add(9*time.Minute), nil)
				mockTokenConnection.EXPECT().GenerateConnectionToken(mock.Anything).Return(&connection.ExpirableSecureValue{Token: "someToken"}, nil)
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(ConnectionHealthResultWithPatchOps{
						TestResults:  testResults,
						HealthStatus: healthStatus,
						PatchOps: []map[string]interface{}{
							{"op": "replace", "path": "/status/health", "value": healthStatus},
						},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Run(
					func(ctx context.Context, conn *provisioning.Connection, patchOperations ...map[string]interface{}) {
						found := false
						for _, op := range patchOperations {
							if op["op"].(string) == "replace" &&
								op["path"].(string) == "/secure/token" &&
								op["value"].(map[string]string)["create"] == "someToken" {
								found = true
							}
						}
						require.True(t, found)
					},
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory
			},
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
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Name: "existing-token",
					},
				},
			},
			expectError: false,
		},
		{
			name: "token expired but health check not needed",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
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
								Checked: time.Now().Add(-1 * time.Minute).UnixMilli(), // Recently checked
							},
						},
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
						},
						Secure: provisioning.ConnectionSecure{
							Token: common.InlineSecureValue{
								Name: "existing-token",
							},
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)
				mockTokenConnection := connection.NewMockTokenConnection(t)
				mockConnWithToken := &mockConnectionWithToken{
					Connection:      mockConnection,
					TokenConnection: mockTokenConnection,
				}

				testResults := &provisioning.TestResults{
					Success: true,
					Code:    http.StatusOK,
				}
				healthStatus := provisioning.HealthStatus{
					Healthy: true,
					Checked: time.Now().UnixMilli(),
				}

				// Health check is NOT needed (recently checked)
				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(false)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnWithToken, nil)
				// Token expires in 9 minutes - with buffer of 10m10s (2*5m + 10s), this WILL trigger regeneration
				mockTokenConnection.EXPECT().ValidateToken().Return(time.Now().Add(9*time.Minute), nil)
				mockTokenConnection.EXPECT().GenerateConnectionToken(mock.Anything).Return(&connection.ExpirableSecureValue{Token: "new-token"}, nil)
				// Health check is still performed as part of reconciliation even though ShouldCheckHealth returned false
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(ConnectionHealthResultWithPatchOps{
						TestResults:  testResults,
						HealthStatus: healthStatus,
						PatchOps: []map[string]interface{}{
							{"op": "replace", "path": "/status/health", "value": healthStatus},
						},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Run(
					func(ctx context.Context, conn *provisioning.Connection, patchOperations ...map[string]interface{}) {
						// Verify token regeneration patch operation exists
						tokenFound := false
						for _, op := range patchOperations {
							if op["op"].(string) == "replace" &&
								op["path"].(string) == "/secure/token" {
								value := op["value"].(map[string]string)
								if value["create"] == "new-token" {
									tokenFound = true
								}
							}
						}
						require.True(t, tokenFound, "Token should be regenerated when expired even if health check not needed")
					},
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory
			},
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
						Checked: time.Now().Add(-1 * time.Minute).UnixMilli(),
					},
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Name: "existing-token",
					},
				},
			},
			expectError: false,
		},
		{
			name: "health check failure",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
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
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnection, nil)
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(ConnectionHealthResultWithPatchOps{}, errors.New("health check failed"))

				return mockLister, mockHealthChecker, nil, mockFactory
			},
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
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
			},
			expectError:   true,
			errorContains: "update health status",
		},
		{
			name: "patch error",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
					conn: &provisioning.Connection{
						ObjectMeta: metav1.ObjectMeta{
							Name:       "test-conn",
							Namespace:  "default",
							Generation: 2,
						},
						Status: provisioning.ConnectionStatus{
							ObservedGeneration: 1,
						},
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)

				testResults := &provisioning.TestResults{
					Success: true,
					Code:    http.StatusOK,
				}
				healthStatus := provisioning.HealthStatus{
					Healthy: true,
					Checked: time.Now().UnixMilli(),
				}

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnection, nil)
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(ConnectionHealthResultWithPatchOps{
						TestResults:  testResults,
						HealthStatus: healthStatus,
						PatchOps: []map[string]interface{}{
							{"op": "replace", "path": "/status/health", "value": healthStatus},
						},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Return(errors.New("patch failed"))

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory
			},
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-conn",
					Namespace:  "default",
					Generation: 2,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
			},
			expectError:   true,
			errorContains: "failed to update connection status",
		},
		{
			// Nothing is left to reconcile, so process returns nil rather than a
			// spurious error and a recorded processing failure.
			name: "connection not found - no-op",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{}

				return mockLister, nil, nil, nil
			},
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-conn",
					Namespace: "default",
				},
			},
			expectError: false,
		},
		{
			name: "build connection error",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
					conn: &provisioning.Connection{
						ObjectMeta: metav1.ObjectMeta{
							Name:       "test-conn",
							Namespace:  "default",
							Generation: 2,
						},
						Status: provisioning.ConnectionStatus{
							ObservedGeneration: 1,
						},
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockFactory := connection.NewMockFactory(t)

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).
					Return(nil, errors.New("failed to build connection"))

				return mockLister, mockHealthChecker, nil, mockFactory
			},
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-conn",
					Namespace:  "default",
					Generation: 2,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
			},
			expectError:   true,
			errorContains: "failed to build connection",
		},
		{
			name: "missing token triggers initial token generation",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
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
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
						},
						Secure: provisioning.ConnectionSecure{
							// No token - IsZero() will return true
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)
				mockTokenConnection := connection.NewMockTokenConnection(t)
				mockConnWithToken := &mockConnectionWithToken{
					Connection:      mockConnection,
					TokenConnection: mockTokenConnection,
				}

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnWithToken, nil)
				// Token is missing, so controller should generate it without checking its state
				mockTokenConnection.EXPECT().GenerateConnectionToken(mock.Anything).Return(&connection.ExpirableSecureValue{Token: "new-token"}, nil)
				// Health check should be performed after token generation
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).Return(
					ConnectionHealthResultWithPatchOps{
						TestResults:  &provisioning.TestResults{Success: true},
						HealthStatus: provisioning.HealthStatus{Healthy: true},
						PatchOps:     []map[string]interface{}{},
					},
					nil,
				)

				mockPatcher := NewMockConnectionStatusPatcher(t)
				mockPatcher.EXPECT().Patch(mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

				return mockLister, mockHealthChecker, mockPatcher, mockFactory
			},
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
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
				Secure: provisioning.ConnectionSecure{
					// No token
				},
			},
			expectError: false,
		},
		{
			name: "invalid token triggers regeneration",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
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
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
						},
						Secure: provisioning.ConnectionSecure{
							Token: common.InlineSecureValue{
								Name: "existing-token",
							},
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)
				mockTokenConnection := connection.NewMockTokenConnection(t)
				mockConnWithToken := &mockConnectionWithToken{
					Connection:      mockConnection,
					TokenConnection: mockTokenConnection,
				}

				testResults := &provisioning.TestResults{
					Success: true,
					Code:    http.StatusOK,
				}
				healthStatus := provisioning.HealthStatus{
					Healthy: true,
					Checked: time.Now().UnixMilli(),
				}

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnWithToken, nil)
				// Token is not usable - should trigger immediate regeneration
				mockTokenConnection.EXPECT().ValidateToken().Return(time.Time{}, errors.New("invalid token"))
				mockTokenConnection.EXPECT().GenerateConnectionToken(mock.Anything).Return(&connection.ExpirableSecureValue{Token: "new-token"}, nil)
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(ConnectionHealthResultWithPatchOps{
						TestResults:  testResults,
						HealthStatus: healthStatus,
						PatchOps: []map[string]interface{}{
							{"op": "replace", "path": "/status/health", "value": healthStatus},
						},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Run(
					func(ctx context.Context, conn *provisioning.Connection, patchOperations ...map[string]interface{}) {
						found := false
						for _, op := range patchOperations {
							if op["op"].(string) == "replace" &&
								op["path"].(string) == "/secure/token" &&
								op["value"].(map[string]string)["create"] == "new-token" {
								found = true
							}
						}
						require.True(t, found, "Token should be regenerated when invalid")
					},
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory
			},
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
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Name: "existing-token",
					},
				},
			},
			expectError: false,
		},
		{
			name: "token generation error - continues with health check",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
					conn: &provisioning.Connection{
						ObjectMeta: metav1.ObjectMeta{
							Name:       "test-conn",
							Namespace:  "default",
							Generation: 1,
						},
						Status: provisioning.ConnectionStatus{
							ObservedGeneration: 1,
							Health: provisioning.HealthStatus{
								Healthy: false,
								Checked: time.Now().Add(-2 * time.Minute).UnixMilli(),
							},
						},
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
						},
						Secure: provisioning.ConnectionSecure{
							Token: common.InlineSecureValue{
								Name: "existing-token",
							},
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)
				mockTokenConnection := connection.NewMockTokenConnection(t)
				mockConnWithToken := &mockConnectionWithToken{
					Connection:      mockConnection,
					TokenConnection: mockTokenConnection,
				}

				testResults := &provisioning.TestResults{
					Success: false,
					Code:    http.StatusBadRequest,
				}
				healthStatus := provisioning.HealthStatus{
					Healthy: false,
					Checked: time.Now().UnixMilli(),
				}

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnWithToken, nil)
				// Token expires in 2 minutes - should trigger regeneration attempt (within 5-minute window)
				mockTokenConnection.EXPECT().ValidateToken().Return(time.Now().Add(2*time.Minute), nil)
				mockTokenConnection.EXPECT().GenerateConnectionToken(mock.Anything).
					Return(nil, errors.New("token generation failed"))
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(ConnectionHealthResultWithPatchOps{
						TestResults:  testResults,
						HealthStatus: healthStatus,
						PatchOps: []map[string]interface{}{
							{"op": "replace", "path": "/status/health", "value": healthStatus},
						},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory
			},
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-conn",
					Namespace:  "default",
					Generation: 1,
				},
				Status: provisioning.ConnectionStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: false,
						Checked: time.Now().Add(-2 * time.Minute).UnixMilli(),
					},
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Name: "existing-token",
					},
				},
			},
			expectError: false,
		},
		{
			name: "token secret not found - rebuilds and regenerates",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory) {
				mockLister := &mockConnectionLister{
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
						Spec: provisioning.ConnectionSpec{
							Type: provisioning.GithubConnectionType,
							GitHub: &provisioning.GitHubConnectionConfig{
								AppID:          "123",
								InstallationID: "456",
							},
						},
						// Orphaned reference: name is set but the secret can't be decrypted.
						Secure: provisioning.ConnectionSecure{
							Token: common.InlineSecureValue{Name: "orphaned-token"},
						},
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnection := connection.NewMockConnection(t)
				mockTokenConnection := connection.NewMockTokenConnection(t)
				mockConnWithToken := &mockConnectionWithToken{
					Connection:      mockConnection,
					TokenConnection: mockTokenConnection,
				}

				// No spec change and health is fresh, so only the token path drives reconcile.
				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(false)

				// First build fails because the token secret is missing; after the reference
				// is cleared the rebuild succeeds.
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).
					Return(nil, fmt.Errorf("unable to decrypt token: %w", connection.ErrTokenNotFound)).Once()
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).
					Return(mockConnWithToken, nil).Once()

				// Token is now zero (cleared), so it is regenerated without validity checks.
				mockTokenConnection.EXPECT().GenerateConnectionToken(mock.Anything).
					Return(&connection.ExpirableSecureValue{Token: "new-token"}, nil)

				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(ConnectionHealthResultWithPatchOps{
						TestResults:  &provisioning.TestResults{Success: true},
						HealthStatus: provisioning.HealthStatus{Healthy: true, Checked: time.Now().UnixMilli()},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory
			},
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-conn",
					Namespace: "default",
				},
			},
			expectError: false,
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			mockLister, mockHealthChecker, mockStatusPatcher, mockFactory := tt.setupMocks()
			cc := &ConnectionController{
				conns:             informer.NewCachedConnectionGetter(mockLister),
				healthChecker:     mockHealthChecker,
				statusPatcher:     mockStatusPatcher,
				connectionFactory: mockFactory,
				logger:            logging.DefaultLogger,
				resyncInterval:    5 * time.Minute,
				tracer:            tracing.InitializeTracerForTest(),
			}

			key := tt.conn.Namespace + "/" + tt.conn.Name
			err := cc.process(t.Context(), key)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				assert.NoError(t, err)
			}

			// Assert all mock expectations were met
			if mockHealthChecker != nil {
				mockHealthChecker.AssertExpectations(t)
			}
			if mockStatusPatcher != nil {
				mockStatusPatcher.AssertExpectations(t)
			}
			if mockFactory != nil {
				mockFactory.AssertExpectations(t)
			}
		})
	}
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
			expectedFieldErrors: []provisioning.ErrorDetails{},
			description:         "fieldErrors should be nil when testResults.Errors is nil",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := t.Context()

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
			mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConn, nil).Maybe()
			mockHealthChecker := NewMockConnectionHealthChecker(t)
			mockHealthChecker.EXPECT().ShouldCheckHealth(mock.IsType(&provisioning.Connection{})).Return(true)
			mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, conn).Return(
				ConnectionHealthResultWithPatchOps{
					TestResults:  tt.testResults,
					HealthStatus: provisioning.HealthStatus{Healthy: false},
				},
				nil,
			)

			// Create controller
			cc := &ConnectionController{
				conns:             informer.NewCachedConnectionGetter(mockLister),
				connectionFactory: mockFactory,
				healthChecker:     mockHealthChecker,
				statusPatcher:     mockPatcher,
				logger:            logging.DefaultLogger,
				tracer:            tracing.InitializeTracerForTest(),
			}

			// Process the connection
			key := "default/test-conn"
			err := cc.process(ctx, key)
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

func (m *mockConnectionNamespaceLister) List(_ labels.Selector) (ret []*provisioning.Connection, err error) {
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

// TestConnectionController_generateConnectionToken_ReturnsExpiry verifies the
// generated token's expiration is threaded back so the reconcile can persist it.
func TestConnectionController_generateConnectionToken_ReturnsExpiry(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	cc := &ConnectionController{tokenMetrics: registerConnectionTokenMetrics(reg)}

	exp := time.Now().Add(10 * time.Minute)
	mockConn := connection.NewMockTokenConnection(t)
	mockConn.EXPECT().GenerateConnectionToken(mock.Anything).
		Return(&connection.ExpirableSecureValue{Token: "tok", ExpiresAt: exp}, nil)

	token, expiresAt, ops, err := cc.generateConnectionToken(context.Background(), mockConn)
	require.NoError(t, err)
	assert.Equal(t, common.RawSecureValue("tok"), token)
	assert.True(t, exp.Equal(expiresAt))
	require.Len(t, ops, 1)
}

// TestConnectionController_shouldGenerateToken_ExpiredCounter verifies that the
// expired counter (from the persisted status.token.expiration) is incremented
// only for an already-expired token, mirroring the repository path. A nil
// TokenConnection is fine: with an empty Secure.Token the method records the
// expired state and returns before it touches the connection.
func TestConnectionController_shouldGenerateToken_ExpiredCounter(t *testing.T) {
	resyncInterval := 5 * time.Minute
	lastUpdated := time.Now().Add(-time.Hour).UnixMilli()

	tests := []struct {
		name        string
		expiration  int64 // epoch millis; 0 means non-expiring
		wantExpired float64
	}{
		{"expired", time.Now().Add(-time.Minute).UnixMilli(), 1},
		{"near expiry is not counted as expired", time.Now().Add(30 * time.Second).UnixMilli(), 0},
		{"valid far from expiry", time.Now().Add(2 * time.Hour).UnixMilli(), 0},
		{"non-expiring", 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewPedanticRegistry()
			cc := &ConnectionController{
				tokenMetrics:   registerConnectionTokenMetrics(reg),
				resyncInterval: resyncInterval,
			}
			obj := &provisioning.Connection{
				Status: provisioning.ConnectionStatus{
					Token: provisioning.TokenStatus{LastUpdated: lastUpdated, Expiration: tt.expiration},
				},
			}

			cc.shouldGenerateToken(context.Background(), obj, nil)

			assert.Equal(t, tt.wantExpired, counterValue(t, reg, "grafana_provisioning_connection_tokens_expired_total"))
		})
	}
}

// TestConnectionController_shouldGenerateToken_BackfillsExpiredFromLiveExpiry
// verifies that a token persisted before expiration tracking (no
// status.token.expiration) still counts as expired via the live validated
// expiry, so pre-upgrade tokens are covered during rollout.
func TestConnectionController_shouldGenerateToken_BackfillsExpiredFromLiveExpiry(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	cc := &ConnectionController{
		tokenMetrics:   registerConnectionTokenMetrics(reg),
		resyncInterval: 5 * time.Minute,
	}
	obj := &provisioning.Connection{
		Status: provisioning.ConnectionStatus{
			// Pre-upgrade token: LastUpdated set, but no persisted expiration.
			Token: provisioning.TokenStatus{LastUpdated: time.Now().Add(-time.Hour).UnixMilli(), Expiration: 0},
		},
		Secure: provisioning.ConnectionSecure{Token: common.InlineSecureValue{Create: "existing-token"}},
	}
	mockConn := connection.NewMockTokenConnection(t)
	mockConn.EXPECT().ValidateToken().Return(time.Now().Add(-time.Minute), nil)

	cc.shouldGenerateToken(context.Background(), obj, mockConn)

	assert.Equal(t, 1.0, counterValue(t, reg, "grafana_provisioning_connection_tokens_expired_total"))
}

func TestConnectionController_shouldGenerateToken_SkipsUnauthorizedOAuthConnections(t *testing.T) {
	cc := &ConnectionController{
		tokenMetrics:   registerConnectionTokenMetrics(prometheus.NewPedanticRegistry()),
		resyncInterval: 5 * time.Minute,
	}
	unauthorized := &provisioning.Connection{}
	oauthConn := struct {
		*connection.MockTokenConnection
		*connection.MockOAuthConnection
	}{connection.NewMockTokenConnection(t), connection.NewMockOAuthConnection(t)}

	assert.False(t, cc.shouldGenerateToken(context.Background(), unauthorized, oauthConn), "an OAuth connection waiting for authorization has no token to generate")
	assert.True(t, cc.shouldGenerateToken(context.Background(), unauthorized, connection.NewMockTokenConnection(t)), "other token connections generate a missing token")
}

func newConnectionControllerForQueueTest(t *testing.T) (*ConnectionController, *prometheus.Registry) {
	t.Helper()
	reg := prometheus.NewPedanticRegistry()
	cc := NewConnectionController(nil, nil, nil, nil, time.Minute, 5*time.Second, reg, nil, false)
	t.Cleanup(cc.workers.Queue().ShutDown)
	return cc, reg
}

func TestConnectionController_RecentlyWrittenTokenReschedulesKey(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		cc, reg := newConnectionControllerForQueueTest(t)
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "conn", ResourceVersion: "5"},
			Secure:     provisioning.ConnectionSecure{Token: common.InlineSecureValue{Name: "recent-token"}},
			Status:     provisioning.ConnectionStatus{Token: provisioning.TokenStatus{LastUpdated: time.Now().UnixMilli()}},
		}
		original := conn.DeepCopy()
		cc.conns = informer.NewCachedConnectionGetter(&mockConnectionLister{conn: conn})
		cc.tracer = tracing.NewNoopTracerService()
		healthChecker := NewMockConnectionHealthChecker(t)
		healthChecker.EXPECT().ShouldCheckHealth(conn).Return(false).Twice()
		cc.healthChecker = healthChecker
		factory := connection.NewMockFactory(t)
		factory.EXPECT().Build(mock.Anything, conn).
			Return(nil, fmt.Errorf("unable to decrypt token: %w", connection.ErrTokenNotFound)).Once()
		factory.EXPECT().Build(mock.Anything, conn).Return(connection.NewMockConnection(t), nil).Once()
		cc.connectionFactory = factory

		cc.EventHandler().AddFunc(conn, true)
		require.True(t, cc.workers.ProcessNextWorkItem(t.Context()))
		synctest.Wait()
		require.Zero(t, cc.workers.Queue().Len())
		assert.Zero(t, cc.workers.Lag())

		time.Sleep(tokenWriteRetryDelay - time.Nanosecond)
		synctest.Wait()
		require.Zero(t, cc.workers.Queue().Len(), "token retry must wait for the configured delay")
		assert.Zero(t, cc.workers.Lag(), "token retry backoff must not count as queue lag")
		time.Sleep(time.Nanosecond)
		synctest.Wait()
		require.Equal(t, 1, cc.workers.Queue().Len())
		require.True(t, cc.workers.ProcessNextWorkItem(t.Context()))
		assert.Zero(t, cc.workers.Queue().Len())
		assert.Zero(t, cc.workers.Queue().NumRequeues("ns/conn"))
		assertOnlyProcessedTrigger(t, reg, "connections", "initial")
		assert.Equal(t, original, conn, "the recent token must not be cleared or regenerated")
	})
}

// TestConnectionController_WorkerQueueWaitHistogram verifies the queue-wait histogram
// records one observation each time a worker picks a key up off the queue.
func TestConnectionController_WorkerQueueWaitHistogram(t *testing.T) {
	const metricName = "grafana_provisioning_connection_worker_queue_wait_seconds"

	reg := prometheus.NewRegistry()
	cc := NewConnectionController(
		nil, nil, nil, nil,
		time.Minute, 30*time.Second,
		reg,
		nil,
		false,
	)

	require.Equal(t, uint64(0), histogramSampleCountByName(t, reg, metricName))

	cc.workers.Queue().Add("ns/conn-a")
	cc.workers.Queue().Add("ns/conn-a")
	cc.workers.Queue().Add("ns/conn-b")

	key, _ := cc.workers.Queue().Get()
	cc.workers.Queue().Done(key)
	require.Equal(t, uint64(1), histogramSampleCountByName(t, reg, metricName))

	key, _ = cc.workers.Queue().Get()
	cc.workers.Queue().Done(key)
	require.Equal(t, uint64(2), histogramSampleCountByName(t, reg, metricName))
}

// TestConnectionController_WorkerQueueSizeGauge verifies the worker-queue-size gauge
// reports the live depth of the replica's local work queue at scrape time.
func TestConnectionController_WorkerQueueSizeGauge(t *testing.T) {
	const metricName = "grafana_provisioning_connection_worker_queue_size"

	reg := prometheus.NewRegistry()
	cc := NewConnectionController(
		nil, nil, nil, nil,
		time.Minute, 30*time.Second,
		reg,
		nil,
		false,
	)

	require.Equal(t, 0.0, gaugeValueByName(t, reg, metricName))

	cc.workers.Queue().Add("ns/conn-a")
	cc.workers.Queue().Add("ns/conn-a")
	cc.workers.Queue().Add("ns/conn-b")
	require.Equal(t, 2.0, gaugeValueByName(t, reg, metricName))

	// Get removes the key from the queue (Len drops); Done clears it from processing.
	key, _ := cc.workers.Queue().Get()
	cc.workers.Queue().Done(key)
	require.Equal(t, 1.0, gaugeValueByName(t, reg, metricName))
}
