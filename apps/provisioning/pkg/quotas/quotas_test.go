package quotas

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestQuotaLimits_EvaluateCondition(t *testing.T) {
	tests := []struct {
		name           string
		stats          []provisioning.ResourceCount
		limits         provisioning.QuotaStatus
		expectedStatus metav1.ConditionStatus
		expectedReason string
		expectedMsg    string
	}{
		{
			name:           "no limits configured returns QuotaUnlimited",
			stats:          []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 100}},
			limits:         provisioning.QuotaStatus{MaxResourcesPerRepository: 0},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonQuotaUnlimited,
			expectedMsg:    "No quota limits configured"},
		{
			name:           "at quota limit returns ResourceQuotaReached",
			stats:          []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 100}},
			limits:         provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonQuotaReached,
			expectedMsg:    "Resource quota reached: 100/100 resources",
		},
		{
			name:           "over quota limit returns ResourceQuotaExceeded",
			stats:          []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 150}},
			limits:         provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonQuotaExceeded,
			expectedMsg:    "Resource quota exceeded: 150/100 resources",
		},
		{
			name: "multiple resource types sums all counts",
			stats: []provisioning.ResourceCount{
				{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 60},
				{Group: "folder.grafana.app", Resource: "folders", Count: 50},
			},
			limits:         provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonQuotaExceeded,
			expectedMsg:    "Resource quota exceeded: 110/100 resources",
		},
		{
			name:           "empty stats returns within quota",
			stats:          []provisioning.ResourceCount{},
			limits:         provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonWithinQuota,
			expectedMsg:    "Within quota: 0/100 resources",
		},
		{
			name:           "nil stats returns within quota",
			stats:          nil,
			limits:         provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonWithinQuota,
			expectedMsg:    "Within quota: 0/100 resources",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			usage := NewQuotaUsageFromStats(tt.stats)
			condition := EvaluateCondition(tt.limits, usage)

			assert.Equal(t, provisioning.ConditionTypeResourceQuota, condition.Type)
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
			getter := NewFixedQuotaGetter(provisioning.QuotaStatus{
				MaxResourcesPerRepository: tt.limits.MaxResourcesPerRepository,
				MaxRepositories:           tt.limits.MaxRepositories,
			})
			status, _ := getter.GetQuotaStatus(ctx, "test-namespace")

			assert.Equal(t, tt.expectedMaxRepositories, status.MaxRepositories)
			assert.Equal(t, tt.expectedMaxResourcesPerRepository, status.MaxResourcesPerRepository)
		})
	}
}

func TestIsQuotaExceeded(t *testing.T) {
	tests := []struct {
		name       string
		conditions []metav1.Condition
		expected   bool
	}{
		{
			name:       "no conditions returns false",
			conditions: nil,
			expected:   false,
		},
		{
			name:       "empty conditions returns false",
			conditions: []metav1.Condition{},
			expected:   false,
		},
		{
			name: "quota exceeded returns true",
			conditions: []metav1.Condition{
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionFalse,
					Reason: provisioning.ReasonQuotaExceeded,
				},
			},
			expected: true,
		},
		{
			name: "within quota returns false",
			conditions: []metav1.Condition{
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioning.ReasonWithinQuota,
				},
			},
			expected: false,
		},
		{
			name: "quota reached returns false",
			conditions: []metav1.Condition{
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioning.ReasonQuotaReached,
				},
			},
			expected: false,
		},
		{
			name: "quota unlimited returns false",
			conditions: []metav1.Condition{
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioning.ReasonQuotaUnlimited,
				},
			},
			expected: false,
		},
		{
			name: "false status but wrong reason returns false",
			conditions: []metav1.Condition{
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionFalse,
					Reason: provisioning.ReasonWithinQuota,
				},
			},
			expected: false,
		},
		{
			name: "unrelated condition is ignored",
			conditions: []metav1.Condition{
				{
					Type:   "SomeOtherCondition",
					Status: metav1.ConditionFalse,
					Reason: provisioning.ReasonQuotaExceeded,
				},
			},
			expected: false,
		},
		{
			name: "quota exceeded among multiple conditions",
			conditions: []metav1.Condition{
				{
					Type:   "SomeOtherCondition",
					Status: metav1.ConditionTrue,
					Reason: "Ready",
				},
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionFalse,
					Reason: provisioning.ReasonQuotaExceeded,
				},
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsQuotaExceeded(tt.conditions)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsQuotaReached(t *testing.T) {
	tests := []struct {
		name       string
		conditions []metav1.Condition
		expected   bool
	}{
		{
			name:       "no conditions returns false",
			conditions: nil,
			expected:   false,
		},
		{
			name:       "empty conditions returns false",
			conditions: []metav1.Condition{},
			expected:   false,
		},
		{
			name: "quota reached returns true",
			conditions: []metav1.Condition{
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioning.ReasonQuotaReached,
				},
			},
			expected: true,
		},
		{
			name: "within quota returns false",
			conditions: []metav1.Condition{
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioning.ReasonWithinQuota,
				},
			},
			expected: false,
		},
		{
			name: "quota exceeded returns false",
			conditions: []metav1.Condition{
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionFalse,
					Reason: provisioning.ReasonQuotaExceeded,
				},
			},
			expected: false,
		},
		{
			name: "quota unlimited returns false",
			conditions: []metav1.Condition{
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioning.ReasonQuotaUnlimited,
				},
			},
			expected: false,
		},
		{
			name: "true status but wrong reason returns false",
			conditions: []metav1.Condition{
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioning.ReasonWithinQuota,
				},
			},
			expected: false,
		},
		{
			name: "unrelated condition is ignored",
			conditions: []metav1.Condition{
				{
					Type:   "SomeOtherCondition",
					Status: metav1.ConditionTrue,
					Reason: provisioning.ReasonQuotaReached,
				},
			},
			expected: false,
		},
		{
			name: "quota reached among multiple conditions",
			conditions: []metav1.Condition{
				{
					Type:   "SomeOtherCondition",
					Status: metav1.ConditionTrue,
					Reason: "Ready",
				},
				{
					Type:   provisioning.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioning.ReasonQuotaReached,
				},
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsQuotaReached(tt.conditions)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestWouldStayWithinQuota(t *testing.T) {
	tests := []struct {
		name      string
		quota     provisioning.QuotaStatus
		usage     Usage
		netChange int64
		expected  bool
	}{
		{
			name:      "unlimited quota always allows",
			quota:     provisioning.QuotaStatus{MaxResourcesPerRepository: 0},
			usage:     Usage{TotalResources: 500},
			netChange: 100,
			expected:  true,
		},
		{
			name:      "within quota with positive change",
			quota:     provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			usage:     Usage{TotalResources: 50},
			netChange: 30,
			expected:  true,
		},
		{
			name:      "exactly at quota with positive change",
			quota:     provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			usage:     Usage{TotalResources: 50},
			netChange: 50,
			expected:  true,
		},
		{
			name:      "exceeds quota with positive change",
			quota:     provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			usage:     Usage{TotalResources: 50},
			netChange: 51,
			expected:  false,
		},
		{
			name:      "already at quota with zero change",
			quota:     provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			usage:     Usage{TotalResources: 100},
			netChange: 0,
			expected:  true,
		},
		{
			name:      "already at quota with positive change",
			quota:     provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			usage:     Usage{TotalResources: 100},
			netChange: 1,
			expected:  false,
		},
		{
			name:      "already over quota with zero change",
			quota:     provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			usage:     Usage{TotalResources: 150},
			netChange: 0,
			expected:  false,
		},
		{
			name:      "negative change brings within quota",
			quota:     provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			usage:     Usage{TotalResources: 110},
			netChange: -20,
			expected:  true,
		},
		{
			name:      "negative change still over quota",
			quota:     provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			usage:     Usage{TotalResources: 150},
			netChange: -10,
			expected:  false,
		},
		{
			name:      "zero usage with zero change",
			quota:     provisioning.QuotaStatus{MaxResourcesPerRepository: 100},
			usage:     Usage{TotalResources: 0},
			netChange: 0,
			expected:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := WouldStayWithinQuota(tt.quota, tt.usage, tt.netChange)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestQuotaExceededError(t *testing.T) {
	t.Run("Error method returns inner error message", func(t *testing.T) {
		inner := fmt.Errorf("repository is over quota (current: 110 resources)")
		quotaErr := &QuotaExceededError{Err: inner}

		require.Equal(t, "repository is over quota (current: 110 resources)", quotaErr.Error())
	})

	t.Run("Error method returns default message when inner error is nil", func(t *testing.T) {
		quotaErr := &QuotaExceededError{}

		require.Equal(t, "quota exceeded", quotaErr.Error())
	})

	t.Run("Unwrap returns underlying error", func(t *testing.T) {
		inner := fmt.Errorf("some inner error")
		quotaErr := &QuotaExceededError{Err: inner}

		unwrapped := quotaErr.Unwrap()
		require.NotNil(t, unwrapped)
		require.Equal(t, inner, unwrapped)
	})

	t.Run("Unwrap returns nil when inner error is nil", func(t *testing.T) {
		quotaErr := &QuotaExceededError{}

		unwrapped := quotaErr.Unwrap()
		require.Nil(t, unwrapped)
	})

	t.Run("errors.As extracts QuotaExceededError", func(t *testing.T) {
		inner := fmt.Errorf("quota limit reached")
		quotaErr := &QuotaExceededError{Err: inner}

		var extractedErr *QuotaExceededError
		require.True(t, errors.As(quotaErr, &extractedErr))
		require.NotNil(t, extractedErr)
		require.NotNil(t, extractedErr.Err)
		require.Equal(t, inner, extractedErr.Err)
	})

	t.Run("errors.As extracts QuotaExceededError from wrapped error", func(t *testing.T) {
		inner := fmt.Errorf("quota limit reached")
		quotaErr := &QuotaExceededError{Err: inner}
		wrapped := fmt.Errorf("sync failed: %w", quotaErr)

		var extractedErr *QuotaExceededError
		require.True(t, errors.As(wrapped, &extractedErr))
		require.NotNil(t, extractedErr)
		require.Equal(t, inner, extractedErr.Err)
	})

	t.Run("errors.As returns false for non-QuotaExceededError", func(t *testing.T) {
		regularErr := errors.New("regular error")

		var extractedErr *QuotaExceededError
		require.False(t, errors.As(regularErr, &extractedErr))
		require.Nil(t, extractedErr)
	})

	t.Run("errors.Is finds underlying error", func(t *testing.T) {
		inner := fmt.Errorf("inner error")
		quotaErr := &QuotaExceededError{Err: inner}

		require.True(t, errors.Is(quotaErr, inner), "errors.Is should find the inner error")
	})

	t.Run("errors.Is does not match unrelated error", func(t *testing.T) {
		inner := fmt.Errorf("inner error")
		quotaErr := &QuotaExceededError{Err: inner}
		unrelated := fmt.Errorf("unrelated error")

		require.False(t, errors.Is(quotaErr, unrelated), "errors.Is should not match unrelated error")
	})
}

func TestFixedQuotaGetter_ImplementsInterface(t *testing.T) {
	// Verify that FixedQuotaGetter implements QuotaGetter interface
	var _ QuotaGetter = (*FixedQuotaGetter)(nil)

	// Also verify it works when used through the interface
	var getter QuotaGetter = NewFixedQuotaGetter(provisioning.QuotaStatus{
		MaxResourcesPerRepository: 25,
		MaxRepositories:           5,
	})

	ctx := context.Background()
	status, _ := getter.GetQuotaStatus(ctx, "test-namespace")
	assert.Equal(t, int64(5), status.MaxRepositories)
	assert.Equal(t, int64(25), status.MaxResourcesPerRepository)
}
