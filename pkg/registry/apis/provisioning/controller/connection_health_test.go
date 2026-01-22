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

func TestConnectionHealthChecker_RefreshHealthWithPatchOps(t *testing.T) {
	testCases := []struct {
		name           string
		conn           *provisioning.Connection
		testResults    *provisioning.TestResults
		testError      error
		expectError    bool
		expectPatches  bool
		expectedHealth bool
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
		},
		{
			name: "failed health check",
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
				Code:    http.StatusBadRequest,
				Errors: []provisioning.ErrorDetails{
					{Detail: "connection failed"},
				},
			},
			expectPatches:  true,
			expectedHealth: false,
		},
		{
			name: "no status change - no patches",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-conn",
					Namespace: "default",
				},
				Status: provisioning.ConnectionStatus{
					Health: provisioning.HealthStatus{
						Healthy: true,
						Checked: time.Now().Add(-20 * time.Second).UnixMilli(),
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
				assert.Len(t, patchOps, 1)
				assert.Equal(t, "replace", patchOps[0]["op"])
				assert.Equal(t, "/status/health", patchOps[0]["path"])
			} else {
				assert.Empty(t, patchOps)
			}
		})
	}
}
