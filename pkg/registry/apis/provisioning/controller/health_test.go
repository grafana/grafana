package controller

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller/mocks"
)

func TestNewHealthChecker(t *testing.T) {
	mockPatcher := mocks.NewStatusPatcher(t)

	hc := NewHealthChecker(mockPatcher)

	assert.NotNil(t, hc)
	assert.Equal(t, mockPatcher, hc.statusPatcher)
}

func TestShouldCheckHealth(t *testing.T) {
	tests := []struct {
		name     string
		repo     *provisioning.Repository
		expected bool
	}{
		{
			name: "should check when generation differs",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Generation: 2},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().UnixMilli(),
					},
				},
			},
			expected: true,
		},
		{
			name: "should not check when hook error exists",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Generation: 1},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: false,
						Error:   provisioning.HealthFailureHook,
						Checked: time.Now().UnixMilli(),
					},
				},
			},
			expected: false,
		},
		{
			name: "should not check when health check is recent and healthy",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Generation: 1},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().Add(-time.Minute * 3).UnixMilli(), // 3 minutes ago
					},
				},
			},
			expected: false,
		},
		{
			name: "should check when health check is old and healthy",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Generation: 1},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().Add(-time.Minute * 6).UnixMilli(), // 6 minutes ago
					},
				},
			},
			expected: true,
		},
		{
			name: "should not check when health error is recent",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Generation: 1},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: false,
						Error:   provisioning.HealthFailureHealth,
						Checked: time.Now().Add(-time.Second * 30).UnixMilli(), // 30 seconds ago
					},
				},
			},
			expected: false,
		},
		{
			name: "should check when health error is old",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Generation: 1},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Healthy: false,
						Error:   provisioning.HealthFailureHealth,
						Checked: time.Now().Add(-time.Minute * 2).UnixMilli(), // 2 minutes ago
					},
				},
			},
			expected: true,
		},
		{
			name: "should check when never checked",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Generation: 1},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Health: provisioning.HealthStatus{
						Checked: 0, // Never checked
					},
				},
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockPatcher := mocks.NewStatusPatcher(t)
			hc := NewHealthChecker(mockPatcher)

			result := hc.ShouldCheckHealth(tt.repo)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestHasRecentFailure(t *testing.T) {
	tests := []struct {
		name         string
		healthStatus provisioning.HealthStatus
		failureType  provisioning.HealthFailureType
		expected     bool
	}{
		{
			name: "no recent failure when never checked",
			healthStatus: provisioning.HealthStatus{
				Checked: 0,
			},
			failureType: provisioning.HealthFailureHook,
			expected:    false,
		},
		{
			name: "recent hook failure",
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHook,
				Checked: time.Now().Add(-time.Second * 30).UnixMilli(),
			},
			failureType: provisioning.HealthFailureHook,
			expected:    true,
		},
		{
			name: "old hook failure",
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHook,
				Checked: time.Now().Add(-time.Minute * 2).UnixMilli(),
			},
			failureType: provisioning.HealthFailureHook,
			expected:    false,
		},
		{
			name: "recent health failure",
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHealth,
				Checked: time.Now().Add(-time.Second * 30).UnixMilli(),
			},
			failureType: provisioning.HealthFailureHealth,
			expected:    true,
		},
		{
			name: "old health failure",
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHealth,
				Checked: time.Now().Add(-time.Minute * 2).UnixMilli(),
			},
			failureType: provisioning.HealthFailureHealth,
			expected:    false,
		},
		{
			name: "wrong failure type",
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHook,
				Checked: time.Now().Add(-time.Second * 30).UnixMilli(),
			},
			failureType: provisioning.HealthFailureHealth,
			expected:    false,
		},
		{
			name: "healthy status with wrong failure type",
			healthStatus: provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().Add(-time.Second * 30).UnixMilli(),
			},
			failureType: provisioning.HealthFailureHook,
			expected:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockPatcher := mocks.NewStatusPatcher(t)
			hc := NewHealthChecker(mockPatcher)

			result := hc.HasRecentFailure(tt.healthStatus, tt.failureType)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRecordFailure(t *testing.T) {
	tests := []struct {
		name        string
		failureType provisioning.HealthFailureType
		err         error
		patchError  error
		expectError bool
	}{
		{
			name:        "successful hook failure record",
			failureType: provisioning.HealthFailureHook,
			err:         errors.New("hook failed"),
			patchError:  nil,
			expectError: false,
		},
		{
			name:        "successful health failure record",
			failureType: provisioning.HealthFailureHealth,
			err:         errors.New("health check failed"),
			patchError:  nil,
			expectError: false,
		},
		{
			name:        "patch failure",
			failureType: provisioning.HealthFailureHook,
			err:         errors.New("hook failed"),
			patchError:  errors.New("patch failed"),
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockPatcher := mocks.NewStatusPatcher(t)
			hc := NewHealthChecker(mockPatcher)

			repo := &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().Add(-time.Hour).UnixMilli(),
					},
				},
			}

			if tt.patchError != nil {
				mockPatcher.On("Patch", mock.Anything, repo, mock.AnythingOfType("map[string]interface {}")).
					Return(tt.patchError)
			} else {
				mockPatcher.On("Patch", mock.Anything, repo, mock.AnythingOfType("map[string]interface {}")).
					Return(nil).
					Run(func(args mock.Arguments) {
						patchOp := args[2].(map[string]interface{})
						assert.Equal(t, "replace", patchOp["op"])
						assert.Equal(t, "/status/health", patchOp["path"])

						healthStatus := patchOp["value"].(provisioning.HealthStatus)
						assert.False(t, healthStatus.Healthy)
						assert.Equal(t, tt.failureType, healthStatus.Error)
						assert.Contains(t, healthStatus.Message, tt.err.Error())
						assert.Greater(t, healthStatus.Checked, int64(0))
					})
			}

			err := hc.RecordFailure(context.Background(), tt.failureType, tt.err, repo)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockPatcher.AssertExpectations(t)
		})
	}
}

func TestRecordFailureFunction(t *testing.T) {
	mockPatcher := mocks.NewStatusPatcher(t)
	hc := NewHealthChecker(mockPatcher)

	testErr := errors.New("test error")
	result := hc.recordFailure(provisioning.HealthFailureHook, testErr)

	assert.False(t, result.Healthy)
	assert.Equal(t, provisioning.HealthFailureHook, result.Error)
	assert.Equal(t, []string{"test error"}, result.Message)
	assert.Greater(t, result.Checked, int64(0))
}

func TestRefreshHealth(t *testing.T) {
	tests := []struct {
		name           string
		testResult     *provisioning.TestResults
		testError      error
		patchError     error
		existingStatus provisioning.HealthStatus
		expectError    bool
		expectedHealth bool
		expectPatch    bool
	}{
		{
			name: "successful health check",
			testResult: &provisioning.TestResults{
				Success: true,
				Code:    200,
			},
			testError: nil,
			existingStatus: provisioning.HealthStatus{
				Healthy: false,
				Error:   provisioning.HealthFailureHealth,
				Checked: time.Now().Add(-time.Hour).UnixMilli(),
			},
			expectError:    false,
			expectedHealth: true,
			expectPatch:    true,
		},
		{
			name: "failed health check",
			testResult: &provisioning.TestResults{
				Success: false,
				Code:    500,
				Errors: []provisioning.ErrorDetails{
					{Detail: "connection failed"},
					{Detail: "timeout"},
				},
			},
			testError: nil,
			existingStatus: provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().Add(-time.Hour).UnixMilli(),
			},
			expectError:    false,
			expectedHealth: false,
			expectPatch:    true,
		},
		{
			name:       "test repository error",
			testResult: nil,
			testError:  errors.New("repository test failed"),
			existingStatus: provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().Add(-time.Hour).UnixMilli(),
			},
			expectError:    true,
			expectedHealth: false,
			expectPatch:    false,
		},
		{
			name: "no status change - no patch needed (recent check)",
			testResult: &provisioning.TestResults{
				Success: true,
				Code:    200,
			},
			testError: nil,
			existingStatus: provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().Add(-15 * time.Second).UnixMilli(),
			},
			expectError:    false,
			expectedHealth: true,
			expectPatch:    false,
		},
		{
			name: "status unchanged but timestamp needs update (old check)",
			testResult: &provisioning.TestResults{
				Success: true,
				Code:    200,
			},
			testError: nil,
			existingStatus: provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().Add(-time.Hour).UnixMilli(),
			},
			expectError:    false,
			expectedHealth: true,
			expectPatch:    true,
		},
		{
			name: "patch error",
			testResult: &provisioning.TestResults{
				Success: false,
				Code:    500,
				Errors: []provisioning.ErrorDetails{
					{Detail: "connection failed"},
				},
			},
			testError:  nil,
			patchError: errors.New("patch failed"),
			existingStatus: provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().Add(-time.Hour).UnixMilli(),
			},
			expectError:    true,
			expectedHealth: false,
			expectPatch:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockPatcher := mocks.NewStatusPatcher(t)
			mockRepo := &mockRepository{
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repository",
						Type:  provisioning.LocalRepositoryType,
					},
					Status: provisioning.RepositoryStatus{
						Health: tt.existingStatus,
					},
				},
				testResult: tt.testResult,
				testError:  tt.testError,
			}

			hc := NewHealthChecker(mockPatcher)

			if tt.expectPatch {
				if tt.patchError != nil {
					mockPatcher.On("Patch", mock.Anything, mockRepo.config, mock.AnythingOfType("map[string]interface {}")).
						Return(tt.patchError)
				} else {
					mockPatcher.On("Patch", mock.Anything, mockRepo.config, mock.AnythingOfType("map[string]interface {}")).
						Return(nil).
						Run(func(args mock.Arguments) {
							patchOp := args[2].(map[string]interface{})
							assert.Equal(t, "replace", patchOp["op"])
							assert.Equal(t, "/status/health", patchOp["path"])

							healthStatus := patchOp["value"].(provisioning.HealthStatus)
							assert.Equal(t, tt.expectedHealth, healthStatus.Healthy)
						})
				}
			}

			testResult, healthStatus, err := hc.RefreshHealth(context.Background(), mockRepo)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedHealth, healthStatus.Healthy)
				if tt.testResult != nil {
					assert.Equal(t, tt.testResult, testResult)
				}
			}
			if tt.expectPatch {
				mockPatcher.AssertExpectations(t)
			}
		})
	}
}

func TestHasHealthStatusChanged(t *testing.T) {
	tests := []struct {
		name     string
		old      provisioning.HealthStatus
		new      provisioning.HealthStatus
		expected bool
	}{
		{
			name: "healthy status changed",
			old: provisioning.HealthStatus{
				Healthy: true,
				Message: []string{},
			},
			new: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error"},
			},
			expected: true,
		},
		{
			name: "different message count",
			old: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error1"},
			},
			new: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error1", "error2"},
			},
			expected: true,
		},
		{
			name: "different messages",
			old: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error1"},
			},
			new: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error2"},
			},
			expected: true,
		},
		{
			name: "no change",
			old: provisioning.HealthStatus{
				Healthy: true,
				Message: []string{},
			},
			new: provisioning.HealthStatus{
				Healthy: true,
				Message: []string{},
			},
			expected: false,
		},
		{
			name: "same messages",
			old: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error1", "error2"},
			},
			new: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error1", "error2"},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockPatcher := mocks.NewStatusPatcher(t)
			hc := NewHealthChecker(mockPatcher)

			result := hc.hasHealthStatusChanged(tt.old, tt.new)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// mockRepository implements repository.Repository interface for testing
type mockRepository struct {
	config     *provisioning.Repository
	testResult *provisioning.TestResults
	testError  error
}

func (m *mockRepository) Config() *provisioning.Repository {
	return m.config
}

func (m *mockRepository) Validate() field.ErrorList {
	return nil
}

func (m *mockRepository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	if m.testError != nil {
		return m.testResult, m.testError
	}
	if m.testResult != nil {
		return m.testResult, nil
	}
	return &provisioning.TestResults{Success: true, Code: 200}, nil
}
