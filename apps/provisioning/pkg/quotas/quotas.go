package quotas

import (
	"context"
	"fmt"
	"sync/atomic"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// QuotaLimits holds all configured quota limits for a repository.
// This struct is designed to be extensible for future quota types.
type QuotaLimits struct {
	// MaxResources is the maximum number of resources allowed per repository.
	// A value of 0 means unlimited.
	MaxResources int64

	// MaxRepositories is the maximum number of repositories allowed per namespace.
	// 0 = unlimited, > 0 = use value
	MaxRepositories int64
}

type Usage struct {
	TotalResources int64
}

func NewQuotaUsageFromStats(stats []provisioning.ResourceCount) Usage {
	return Usage{
		TotalResources: calculateTotalResources(stats),
	}
}

// EvaluateCondition creates a Quota condition based on current stats and quota status.
// Returns True if all quotas pass (or no limits configured), False if any quota is reached/exceeded.
func EvaluateCondition(quota provisioning.RepositoryQuotaStatus, quotaUsage Usage) metav1.Condition {
	// Check if any limits are configured
	if ptr.Deref(quota.MaxResourcesPerRepository, 0) == 0 {
		return metav1.Condition{
			Type:    provisioning.ConditionTypeResourceQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonQuotaUnlimited,
			Message: "No quota limits configured",
		}
	}

	total := quotaUsage.TotalResources

	switch {
	case total > ptr.Deref(quota.MaxResourcesPerRepository, 0):
		return metav1.Condition{
			Type:    provisioning.ConditionTypeResourceQuota,
			Status:  metav1.ConditionFalse,
			Reason:  provisioning.ReasonQuotaExceeded,
			Message: fmt.Sprintf("Resource quota exceeded: %d/%d resources", total, ptr.Deref(quota.MaxResourcesPerRepository, 0)),
		}
	case total == ptr.Deref(quota.MaxResourcesPerRepository, 0):
		return metav1.Condition{
			Type:    provisioning.ConditionTypeResourceQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonQuotaReached,
			Message: fmt.Sprintf("Resource quota reached: %d/%d resources", total, ptr.Deref(quota.MaxResourcesPerRepository, 0)),
		}
	default:
		return metav1.Condition{
			Type:    provisioning.ConditionTypeResourceQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonWithinQuota,
			Message: fmt.Sprintf("Within quota: %d/%d resources", total, ptr.Deref(quota.MaxResourcesPerRepository, 0)),
		}
	}
}

// IsQuotaExceeded checks if the resource quota condition indicates the quota has been exceeded.
func IsQuotaExceeded(conditions []metav1.Condition) bool {
	for i := range conditions {
		if conditions[i].Type == provisioning.ConditionTypeResourceQuota {
			return conditions[i].Status == metav1.ConditionFalse &&
				conditions[i].Reason == provisioning.ReasonQuotaExceeded
		}
	}
	return false
}

// IsQuotaReached checks if the resource quota condition indicates the quota has been reached (at limit).
func IsQuotaReached(conditions []metav1.Condition) bool {
	for i := range conditions {
		if conditions[i].Type == provisioning.ConditionTypeResourceQuota {
			return conditions[i].Status == metav1.ConditionTrue &&
				conditions[i].Reason == provisioning.ReasonQuotaReached
		}
	}
	return false
}

func WouldStayWithinQuota(quota provisioning.RepositoryQuotaStatus, usage Usage, netChange int64) bool {
	if ptr.Deref(quota.MaxResourcesPerRepository, 0) == 0 {
		return true
	}
	return usage.TotalResources+netChange <= ptr.Deref(quota.MaxResourcesPerRepository, 0)
}

// calculateTotalResources sums up all resource counts from the stats.
func calculateTotalResources(stats []provisioning.ResourceCount) int64 {
	var total int64
	for _, s := range stats {
		total += s.Count
	}
	return total
}

// QuotaGetter retrieves quota information for repositories.
type QuotaGetter interface {
	// GetQuotaStatus returns the quota status to be set on repositories.
	// It takes a context and namespace to allow for future implementations
	// that may need to fetch quota information dynamically.
	GetQuotaStatus(ctx context.Context, namespace string) (provisioning.RepositoryQuotaStatus, error)
}

// FixedQuotaGetter returns fixed quota values from static configuration.
type FixedQuotaGetter struct {
	quotaStatus atomic.Value // stores provisioning.QuotaStatus
	forcedError atomic.Value // stores fixedQuotaGetterError for test-only failure injection
}

type fixedQuotaGetterError struct {
	err error
}

// NewFixedQuotaGetter creates a new FixedQuotaGetter from QuotaStatus.
func NewFixedQuotaGetter(quotaStatus provisioning.RepositoryQuotaStatus) *FixedQuotaGetter {
	f := &FixedQuotaGetter{}
	f.quotaStatus.Store(quotaStatus)
	f.forcedError.Store(fixedQuotaGetterError{})
	return f
}

// GetQuotaStatus returns the configured quota limits as a QuotaStatus.
func (f *FixedQuotaGetter) GetQuotaStatus(_ context.Context, _ string) (provisioning.RepositoryQuotaStatus, error) {
	if state := f.forcedError.Load().(fixedQuotaGetterError); state.err != nil {
		return provisioning.RepositoryQuotaStatus{}, state.err
	}
	return f.quotaStatus.Load().(provisioning.RepositoryQuotaStatus), nil
}

// SetQuotaStatus updates the quota status, allowing runtime changes (primarily for testing).
func (f *FixedQuotaGetter) SetQuotaStatus(status provisioning.RepositoryQuotaStatus) {
	f.quotaStatus.Store(status)
}

// SetError makes GetQuotaStatus return err. This method exists only to support tests.
func (f *FixedQuotaGetter) SetError(err error) {
	f.forcedError.Store(fixedQuotaGetterError{err: err})
}

var _ QuotaGetter = (*FixedQuotaGetter)(nil)

func NewQuotaExceededError(err error) *QuotaExceededError {
	return &QuotaExceededError{Err: err}
}

type QuotaExceededError struct {
	Err error
}

// Error implements the error interface
func (e *QuotaExceededError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return "quota exceeded"
}

// Unwrap implements error unwrapping to support errors.Is and errors.As
func (e *QuotaExceededError) Unwrap() error {
	return e.Err
}
