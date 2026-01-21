package controller

import (
	"context"
	"errors"
	"net/http"
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
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller/mocks"
)

// mockConnectionWithToken is a test helper that implements both Connection and TokenConnection
type mockConnectionWithToken struct {
	mock.Mock
}

func (m *mockConnectionWithToken) TokenExpiration(ctx context.Context) (time.Time, error) {
	args := m.Called(ctx)
	return args.Get(0).(time.Time), args.Error(1)
}

func (m *mockConnectionWithToken) GenerateConnectionToken(ctx context.Context) (common.RawSecureValue, error) {
	args := m.Called(ctx)
	return args.Get(0).(common.RawSecureValue), args.Error(1)
}

func (m *mockConnectionWithToken) GenerateRepositoryToken(ctx context.Context, repo *provisioning.Repository) (*connection.ExpirableSecureValue, error) {
	args := m.Called(ctx, repo)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*connection.ExpirableSecureValue), args.Error(1)
}

func (m *mockConnectionWithToken) ListRepositories(ctx context.Context) ([]provisioning.ExternalRepository, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]provisioning.ExternalRepository), args.Error(1)
}

func (m *mockConnectionWithToken) Test(ctx context.Context) (*provisioning.TestResults, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*provisioning.TestResults), args.Error(1)
}

func TestConnectionController_process(t *testing.T) {
	testCases := []struct {
		name          string
		setupMocks    func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{})
		conn          *provisioning.Connection
		expectError   bool
		errorContains string
	}{
		{
			name: "deletion timestamp - skip without error",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{}) {
				mockLister := &mockConnectionLister{
					conn: &provisioning.Connection{
						ObjectMeta: metav1.ObjectMeta{
							Name:              "test-conn",
							Namespace:         "default",
							DeletionTimestamp: &metav1.Time{Time: time.Now()},
						},
					},
				}
				return mockLister, nil, nil, nil, nil
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
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{}) {
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
				return mockLister, mockHealthChecker, nil, nil, nil
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
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{}) {
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
					Return(testResults, healthStatus, []map[string]interface{}{
						{"op": "replace", "path": "/status/health", "value": healthStatus},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory, mockConnection
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
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{}) {
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
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnWithToken := &mockConnectionWithToken{}

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
				// Token expires in 2 minutes - should trigger regeneration (within 5-minute window)
				mockConnWithToken.On("TokenExpiration", mock.Anything).Return(time.Now().Add(2*time.Minute), nil)
				mockConnWithToken.On("GenerateConnectionToken", mock.Anything).
					Return(common.RawSecureValue("new-token"), nil)
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(testResults, healthStatus, []map[string]interface{}{
						{"op": "replace", "path": "/status/health", "value": healthStatus},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory, mockConnWithToken
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
			},
			expectError: false,
		},
		{
			name: "token not expired and not regenerated",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{}) {
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
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnWithToken := &mockConnectionWithToken{}

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
				// Token expires in 10 minutes - with current logic, this WILL trigger regeneration
				mockConnWithToken.On("TokenExpiration", mock.Anything).Return(time.Now().Add(10*time.Minute), nil)
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(testResults, healthStatus, []map[string]interface{}{
						{"op": "replace", "path": "/status/health", "value": healthStatus},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything,
					mock.Anything, mock.Anything, mock.Anything,
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory, mockConnWithToken
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
			expectError: false,
		},
		{
			name: "health check failure",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{}) {
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
					Return(nil, provisioning.HealthStatus{}, nil, errors.New("health check failed"))

				return mockLister, mockHealthChecker, nil, mockFactory, mockConnection
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
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{}) {
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
					Return(testResults, healthStatus, []map[string]interface{}{
						{"op": "replace", "path": "/status/health", "value": healthStatus},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Return(errors.New("patch failed"))

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory, mockConnection
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
			name: "connection not found",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{}) {
				mockLister := &mockConnectionLister{}

				return mockLister, nil, nil, nil, nil
			},
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-conn",
					Namespace: "default",
				},
			},
			expectError: true,
		},
		{
			name: "build connection error",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{}) {
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

				return mockLister, mockHealthChecker, nil, mockFactory, nil
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
			name: "token expiration check error",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{}) {
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
				mockConnWithToken := &mockConnectionWithToken{}

				mockHealthChecker.EXPECT().ShouldCheckHealth(mock.Anything).Return(true)
				mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnWithToken, nil)
				mockConnWithToken.On("TokenExpiration", mock.Anything).
					Return(time.Time{}, errors.New("failed to check token expiration"))

				return mockLister, mockHealthChecker, nil, mockFactory, mockConnWithToken
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
			expectError: true,
		},
		{
			name: "token generation error - continues with health check",
			setupMocks: func() (*mockConnectionLister, *MockConnectionHealthChecker, *MockConnectionStatusPatcher, *connection.MockFactory, interface{}) {
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
					},
				}
				mockHealthChecker := NewMockConnectionHealthChecker(t)
				mockStatusPatcher := NewMockConnectionStatusPatcher(t)
				mockFactory := connection.NewMockFactory(t)
				mockConnWithToken := &mockConnectionWithToken{}

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
				mockConnWithToken.On("TokenExpiration", mock.Anything).Return(time.Now().Add(2*time.Minute), nil)
				mockConnWithToken.On("GenerateConnectionToken", mock.Anything).
					Return(common.RawSecureValue(""), errors.New("token generation failed"))
				mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, mock.Anything).
					Return(testResults, healthStatus, []map[string]interface{}{
						{"op": "replace", "path": "/status/health", "value": healthStatus},
					}, nil)
				mockStatusPatcher.EXPECT().Patch(
					mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything,
				).Return(nil)

				return mockLister, mockHealthChecker, mockStatusPatcher, mockFactory, mockConnWithToken
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
			},
			expectError: false,
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			mockLister, mockHealthChecker, mockStatusPatcher, mockFactory, extraMock := tt.setupMocks()
			cc := &ConnectionController{
				connLister:        mockLister,
				healthChecker:     mockHealthChecker,
				statusPatcher:     mockStatusPatcher,
				connectionFactory: mockFactory,
				logger:            logging.DefaultLogger,
			}

			item := &connectionQueueItem{key: tt.conn.Namespace + "/" + tt.conn.Name}
			err := cc.process(context.Background(), item)

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
			if extraMock != nil {
				switch m := extraMock.(type) {
				case *mockConnectionWithToken:
					m.AssertExpectations(t)
				}
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
			mockFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConn, nil).Maybe()
			mockHealthChecker := NewMockConnectionHealthChecker(t)
			mockHealthChecker.EXPECT().ShouldCheckHealth(mock.IsType(&provisioning.Connection{})).Return(true)
			mockHealthChecker.EXPECT().RefreshHealthWithPatchOps(mock.Anything, conn).Return(
				tt.testResults, provisioning.HealthStatus{Healthy: false}, nil, nil,
			)

			// Create controller
			cc := &ConnectionController{
				connLister:        mockLister,
				connectionFactory: mockFactory,
				healthChecker:     mockHealthChecker,
				connSynced:        func() bool { return true },
				statusPatcher:     mockPatcher,
				logger:            logging.DefaultLogger,
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
