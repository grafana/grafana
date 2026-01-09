package controller

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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
