package quotas

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestQuotaLimits_EvaluateCondition(t *testing.T) {
	tests := []struct {
		name           string
		usage          Usage
		limits         provisioning.QuotaStatus
		expectedStatus metav1.ConditionStatus
		expectedReason string
		expectedMsg    string
	}{
		{
			name:           "no limits configured returns QuotaUnlimited",
			usage:          Usage{TotalResources: 100},
			limits:         provisioning.QuotaStatus{MaxResourcesPerRepository: 0},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonQuotaUnlimited,
			expectedMsg:    "No quota limits configured",
		},
		{
			name:           "within quota returns WithinQuota",
			usage:          Usage{TotalResources: 50},
			limits:         provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonWithinQuota,
			expectedMsg:    "Within quota: 50/100 resources",
		},
		{
			name:           "at quota limit returns ResourceQuotaReached",
			usage:          Usage{TotalResources: 100},
			limits:         provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonResourceQuotaReached,
			expectedMsg:    "Resource quota reached: 100/100 resources",
		},
		{
			name:           "over quota limit returns ResourceQuotaExceeded",
			usage:          Usage{TotalResources: 150},
			limits:         provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonResourceQuotaExceeded,
			expectedMsg:    "Resource quota exceeded: 150/100 resources",
		},
		{
			name:           "empty stats returns within quota",
			usage:          Usage{TotalResources: 0},
			limits:         provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonWithinQuota,
			expectedMsg:    "Within quota: 0/100 resources",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			condition := EvaluateCondition(tt.limits, tt.usage)

			assert.Equal(t, provisioning.ConditionTypeQuota, condition.Type)
			assert.Equal(t, tt.expectedStatus, condition.Status)
			assert.Equal(t, tt.expectedReason, condition.Reason)
			assert.Equal(t, tt.expectedMsg, condition.Message)
		})
	}
}

func TestCalculateTotalResources(t *testing.T) {
	tests := []struct {
		name     string
		stats    []provisioning.ResourceCount
		expected int64
	}{
		{
			name:     "nil stats returns 0",
			stats:    nil,
			expected: 0,
		},
		{
			name:     "empty stats returns 0",
			stats:    []provisioning.ResourceCount{},
			expected: 0,
		},
		{
			name: "single resource type",
			stats: []provisioning.ResourceCount{
				{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 42},
			},
			expected: 42,
		},
		{
			name: "multiple resource types",
			stats: []provisioning.ResourceCount{
				{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 30},
				{Group: "folder.grafana.app", Resource: "folders", Count: 12},
			},
			expected: 42,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculateTotalResources(tt.stats)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestFixedQuotaLimitsProvider(t *testing.T) {
	tests := []struct {
		name                              string
		limits                            provisioning.QuotaStatus
		expectedMaxRepositories           int64
		expectedMaxResourcesPerRepository int64
	}{
		{
			name: "maps QuotaLimits to QuotaStatus correctly",
			limits: provisioning.QuotaStatus{
				MaxResourcesPerRepository: 100,
				MaxRepositories:           10,
			},
			expectedMaxRepositories:           10,
			expectedMaxResourcesPerRepository: 100,
		},
		{
			name: "handles zero values (unlimited)",
			limits: provisioning.QuotaStatus{
				MaxResourcesPerRepository: 0,
				MaxRepositories:           0,
			},
			expectedMaxRepositories:           0,
			expectedMaxResourcesPerRepository: 0,
		},
		{
			name: "handles mixed values",
			limits: provisioning.QuotaStatus{
				MaxResourcesPerRepository: 50,
				MaxRepositories:           0,
			},
			expectedMaxRepositories:           0,
			expectedMaxResourcesPerRepository: 50,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			provider := NewFixedQuotaLimitsProvider(tt.limits)
			status, err := provider.GetQuotaStatus(ctx, "test-namespace")

			assert.NoError(t, err)
			assert.Equal(t, tt.expectedMaxRepositories, status.MaxRepositories)
			assert.Equal(t, tt.expectedMaxResourcesPerRepository, status.MaxResourcesPerRepository)
		})
	}
}

func TestFixedQuotaLimitsProvider_ImplementsInterface(t *testing.T) {
	// Verify that FixedQuotaLimitsProvider implements QuotaLimitsProvider interface
	var _ QuotaLimitsProvider = (*FixedQuotaLimitsProvider)(nil)

	// Also verify it works when used through the interface
	var provider QuotaLimitsProvider = NewFixedQuotaLimitsProvider(provisioning.QuotaStatus{
		MaxResourcesPerRepository: 25,
		MaxRepositories:           5,
	})

	ctx := context.Background()
	status, err := provider.GetQuotaStatus(ctx, "test-namespace")
	assert.NoError(t, err)
	assert.Equal(t, int64(5), status.MaxRepositories)
	assert.Equal(t, int64(25), status.MaxResourcesPerRepository)
}
