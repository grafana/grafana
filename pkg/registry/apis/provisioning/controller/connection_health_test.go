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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestConnectionHealthChecker_ShouldCheckHealth(t *testing.T) {
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
			hc := &ConnectionHealthChecker{}
			result := hc.ShouldCheckHealth(tc.conn)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestConnectionHealthChecker_hasRecentHealthCheck(t *testing.T) {
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
			hc := &ConnectionHealthChecker{}
			result := hc.hasRecentHealthCheck(tc.healthStatus)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestConnectionHealthChecker_hasHealthStatusChanged(t *testing.T) {
	baseTime := time.Now()

	testCases := []struct {
		name     string
		old      provisioning.HealthStatus
		new      provisioning.HealthStatus
		expected bool
	}{
		{
			name: "healthy status changed",
			old: provisioning.HealthStatus{
				Healthy: true,
				Checked: baseTime.UnixMilli(),
			},
			new: provisioning.HealthStatus{
				Healthy: false,
				Checked: baseTime.UnixMilli(),
			},
			expected: true,
		},
		{
			name: "message count changed",
			old: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error1"},
				Checked: baseTime.UnixMilli(),
			},
			new: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error1", "error2"},
				Checked: baseTime.UnixMilli(),
			},
			expected: true,
		},
		{
			name: "message content changed",
			old: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error1"},
				Checked: baseTime.UnixMilli(),
			},
			new: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error2"},
				Checked: baseTime.UnixMilli(),
			},
			expected: true,
		},
		{
			name: "timestamp changed beyond threshold (healthy)",
			old: provisioning.HealthStatus{
				Healthy: true,
				Checked: baseTime.Add(-6 * time.Minute).UnixMilli(),
			},
			new: provisioning.HealthStatus{
				Healthy: true,
				Checked: baseTime.UnixMilli(),
			},
			expected: true,
		},
		{
			name: "timestamp changed beyond threshold (unhealthy)",
			old: provisioning.HealthStatus{
				Healthy: false,
				Checked: baseTime.Add(-2 * time.Minute).UnixMilli(),
			},
			new: provisioning.HealthStatus{
				Healthy: false,
				Checked: baseTime.UnixMilli(),
			},
			expected: true,
		},
		{
			name: "no meaningful change",
			old: provisioning.HealthStatus{
				Healthy: true,
				Checked: baseTime.UnixMilli(),
			},
			new: provisioning.HealthStatus{
				Healthy: true,
				Checked: baseTime.Add(10 * time.Second).UnixMilli(),
			},
			expected: false,
		},
		{
			name: "same unhealthy status within threshold",
			old: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error"},
				Checked: baseTime.Add(-30 * time.Second).UnixMilli(),
			},
			new: provisioning.HealthStatus{
				Healthy: false,
				Message: []string{"error"},
				Checked: baseTime.UnixMilli(),
			},
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			hc := &ConnectionHealthChecker{}
			result := hc.hasHealthStatusChanged(tc.old, tc.new)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestClassifyConnectionError(t *testing.T) {
	testCases := []struct {
		name           string
		testResults    *provisioning.TestResults
		expectedReason string
	}{
		{
			name: "successful test",
			testResults: &provisioning.TestResults{
				Success: true,
				Code:    http.StatusOK,
			},
			expectedReason: provisioning.ReasonAvailable,
		},
		{
			name: "validation error (422)",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusUnprocessableEntity,
				Errors:  []provisioning.ErrorDetails{{Detail: "missing required field"}},
			},
			expectedReason: provisioning.ReasonInvalidSpec,
		},
		{
			name: "bad request (400)",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusBadRequest,
				Errors:  []provisioning.ErrorDetails{{Detail: "invalid appID"}},
			},
			expectedReason: provisioning.ReasonInvalidSpec,
		},
		{
			name: "unauthorized (401)",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusUnauthorized,
				Errors:  []provisioning.ErrorDetails{{Detail: "invalid credentials"}},
			},
			expectedReason: provisioning.ReasonAuthenticationFailed,
		},
		{
			name: "forbidden (403)",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusForbidden,
				Errors:  []provisioning.ErrorDetails{{Detail: "permission denied"}},
			},
			expectedReason: provisioning.ReasonAuthenticationFailed,
		},
		{
			name: "not found (404)",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusNotFound,
				Errors:  []provisioning.ErrorDetails{{Detail: "app not found"}},
			},
			expectedReason: provisioning.ReasonInvalidSpec,
		},
		{
			name: "internal server error (500)",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusInternalServerError,
				Errors:  []provisioning.ErrorDetails{{Detail: "secret decryption failed"}},
			},
			expectedReason: provisioning.ReasonInvalidSpec,
		},
		{
			name: "bad gateway (502)",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusBadGateway,
				Errors:  []provisioning.ErrorDetails{{Detail: "token generation failed"}},
			},
			expectedReason: provisioning.ReasonInvalidSpec,
		},
		{
			name: "service unavailable (503)",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusServiceUnavailable,
				Errors:  []provisioning.ErrorDetails{{Detail: "GitHub API unavailable"}},
			},
			expectedReason: provisioning.ReasonServiceUnavailable,
		},
		{
			name: "gateway timeout (504)",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusGatewayTimeout,
				Errors:  []provisioning.ErrorDetails{{Detail: "connection timeout"}},
			},
			expectedReason: provisioning.ReasonInvalidSpec,
		},
		{
			name: "too many requests (429)",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusTooManyRequests,
				Errors:  []provisioning.ErrorDetails{{Detail: "rate limit exceeded"}},
			},
			expectedReason: provisioning.ReasonInvalidSpec,
		},
		{
			name: "unknown error code defaults to invalid configuration",
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    999,
				Errors:  []provisioning.ErrorDetails{{Detail: "unknown error"}},
			},
			expectedReason: provisioning.ReasonInvalidSpec,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			reason := classifyConnectionError(tc.testResults)
			assert.Equal(t, tc.expectedReason, reason)
		})
	}
}

func TestConnectionHealthChecker_RefreshHealthWithPatchOps(t *testing.T) {
	testCases := []struct {
		name           string
		conn           *provisioning.Connection
		testResults    *provisioning.TestResults
		testError      error
		expectError    bool
		expectPatches  bool
		expectedHealth bool
		expectedReason string
	}{
		{
			name: "successful health check with status change",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-conn",
					Namespace: "default",
				},
				Status: provisioning.ConnectionStatus{
					Health: provisioning.HealthStatus{
						Healthy: false,
						Checked: time.Now().Add(-10 * time.Minute).UnixMilli(),
					},
				},
			},
			testResults: &provisioning.TestResults{
				Success: true,
				Code:    http.StatusOK,
			},
			expectPatches:  true,
			expectedHealth: true,
			expectedReason: provisioning.ReasonAvailable,
		},
		{
			name: "failed health check - authentication failed",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-conn",
					Namespace: "default",
				},
				Status: provisioning.ConnectionStatus{
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().Add(-10 * time.Minute).UnixMilli(),
					},
				},
			},
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusUnauthorized,
				Errors: []provisioning.ErrorDetails{
					{Detail: "invalid credentials"},
				},
			},
			expectPatches:  true,
			expectedHealth: false,
			expectedReason: provisioning.ReasonAuthenticationFailed,
		},
		{
			name: "failed health check - service unavailable",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-conn",
					Namespace: "default",
				},
				Status: provisioning.ConnectionStatus{
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().Add(-10 * time.Minute).UnixMilli(),
					},
				},
			},
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    http.StatusServiceUnavailable,
				Errors: []provisioning.ErrorDetails{
					{Detail: "service unavailable"},
				},
			},
			expectPatches:  true,
			expectedHealth: false,
			expectedReason: provisioning.ReasonServiceUnavailable,
		},
		{
			name: "no status change - no patches",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-conn",
					Namespace:  "default",
					Generation: 1,
				},
				Status: provisioning.ConnectionStatus{
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().Add(-20 * time.Second).UnixMilli(),
					},
					Conditions: []metav1.Condition{
						{
							Type:               provisioning.ConditionTypeReady,
							Status:             metav1.ConditionTrue,
							Reason:             provisioning.ReasonAvailable,
							Message:            "Resource is available",
							ObservedGeneration: 1,
							LastTransitionTime: metav1.Now(),
						},
					},
				},
			},
			testResults: &provisioning.TestResults{
				Success: true,
				Code:    http.StatusOK,
			},
			expectPatches:  false,
			expectedHealth: true,
		},
		{
			name: "test connection error",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-conn",
					Namespace: "default",
				},
			},
			testError:   errors.New("test failed"),
			expectError: true,
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			mockTester := NewMockConnectionTester(t)
			mockMetrics := NewMockHealthMetricsRecorder(t)

			if tt.testError != nil {
				mockTester.EXPECT().TestConnection(mock.Anything, tt.conn).Return(nil, tt.testError)
			} else {
				mockTester.EXPECT().TestConnection(mock.Anything, tt.conn).Return(tt.testResults, nil)
			}
			mockMetrics.EXPECT().RecordHealthCheck("connection", mock.Anything, mock.Anything).Return()

			hc := NewConnectionHealthChecker(mockTester, mockMetrics)
			testResults, healthStatus, patchOps, err := hc.RefreshHealthWithPatchOps(context.Background(), tt.conn)

			if tt.expectError {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.NotNil(t, testResults)
			assert.Equal(t, tt.expectedHealth, healthStatus.Healthy)

			if tt.expectPatches {
				// Should have 2 patches: health and condition
				assert.Len(t, patchOps, 2)

				// First patch should be health
				assert.Equal(t, "replace", patchOps[0]["op"])
				assert.Equal(t, "/status/health", patchOps[0]["path"])

				// Second patch should be conditions with Ready condition
				assert.Equal(t, "replace", patchOps[1]["op"])
				assert.Equal(t, "/status/conditions", patchOps[1]["path"])

				// Verify Ready condition is set correctly
				conditions, ok := patchOps[1]["value"].([]metav1.Condition)
				require.True(t, ok, "conditions should be of type []metav1.Condition")
				require.Len(t, conditions, 1, "should have exactly one condition")

				readyCondition := conditions[0]
				assert.Equal(t, provisioning.ConditionTypeReady, readyCondition.Type)

				if tt.expectedHealth {
					assert.Equal(t, metav1.ConditionTrue, readyCondition.Status)
					assert.Equal(t, provisioning.ReasonAvailable, readyCondition.Reason)
				} else {
					assert.Equal(t, metav1.ConditionFalse, readyCondition.Status)
					assert.Equal(t, tt.expectedReason, readyCondition.Reason)
				}
			} else {
				assert.Empty(t, patchOps)
			}
		})
	}
}
