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
		stats          []provisioning.ResourceCount
		limits         QuotaLimits
		expectedStatus metav1.ConditionStatus
		expectedReason string
		expectedMsg    string
	}{
		{
			name:           "no limits configured returns QuotaUnlimited",
			stats:          []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 100}},
			limits:         QuotaLimits{MaxResources: 0},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonQuotaUnlimited,
			expectedMsg:    "No quota limits configured",
		},
		{
			name:           "within quota returns WithinQuota",
			stats:          []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 50}},
			limits:         QuotaLimits{MaxResources: 100},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonWithinQuota,
			expectedMsg:    "Within quota: 50/100 resources",
		},
		{
			name:           "at quota limit returns ResourceQuotaReached",
			stats:          []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 100}},
			limits:         QuotaLimits{MaxResources: 100},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonResourceQuotaReached,
			expectedMsg:    "Resource quota reached: 100/100 resources",
		},
		{
			name:           "over quota limit returns ResourceQuotaExceeded",
			stats:          []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 150}},
			limits:         QuotaLimits{MaxResources: 100},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonResourceQuotaExceeded,
			expectedMsg:    "Resource quota exceeded: 150/100 resources",
		},
		{
			name: "multiple resource types sums all counts",
			stats: []provisioning.ResourceCount{
				{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 60},
				{Group: "folder.grafana.app", Resource: "folders", Count: 50},
			},
			limits:         QuotaLimits{MaxResources: 100},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonResourceQuotaExceeded,
			expectedMsg:    "Resource quota exceeded: 110/100 resources",
		},
		{
			name:           "empty stats returns within quota",
			stats:          []provisioning.ResourceCount{},
			limits:         QuotaLimits{MaxResources: 100},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonWithinQuota,
			expectedMsg:    "Within quota: 0/100 resources",
		},
		{
			name:           "nil stats returns within quota",
			stats:          nil,
			limits:         QuotaLimits{MaxResources: 100},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonWithinQuota,
			expectedMsg:    "Within quota: 0/100 resources",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			condition := tt.limits.EvaluateCondition(tt.stats)

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

func TestFixedQuotaGetter(t *testing.T) {
	tests := []struct {
		name                              string
		limits                            QuotaLimits
		expectedMaxRepositories           int64
		expectedMaxResourcesPerRepository int64
	}{
		{
			name: "maps QuotaLimits to QuotaStatus correctly",
			limits: QuotaLimits{
				MaxResources:    100,
				MaxRepositories: 10,
			},
			expectedMaxRepositories:           10,
			expectedMaxResourcesPerRepository: 100,
		},
		{
			name: "handles zero values (unlimited)",
			limits: QuotaLimits{
				MaxResources:    0,
				MaxRepositories: 0,
			},
			expectedMaxRepositories:           0,
			expectedMaxResourcesPerRepository: 0,
		},
		{
			name: "handles mixed values",
			limits: QuotaLimits{
				MaxResources:    50,
				MaxRepositories: 0,
			},
			expectedMaxRepositories:           0,
			expectedMaxResourcesPerRepository: 50,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			getter := NewFixedQuotaGetter(tt.limits)
			status := getter.GetQuotaStatus(ctx, "test-namespace")

			assert.Equal(t, tt.expectedMaxRepositories, status.MaxRepositories)
			assert.Equal(t, tt.expectedMaxResourcesPerRepository, status.MaxResourcesPerRepository)
		})
	}
}

func TestFixedQuotaGetter_ImplementsInterface(t *testing.T) {
	// Verify that FixedQuotaGetter implements QuotaGetter interface
	var _ QuotaGetter = (*FixedQuotaGetter)(nil)

	// Also verify it works when used through the interface
	var getter QuotaGetter = NewFixedQuotaGetter(QuotaLimits{
		MaxResources:    25,
		MaxRepositories: 5,
	})

	ctx := context.Background()
	status := getter.GetQuotaStatus(ctx, "test-namespace")
	assert.Equal(t, int64(5), status.MaxRepositories)
	assert.Equal(t, int64(25), status.MaxResourcesPerRepository)
}
