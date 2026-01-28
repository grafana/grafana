package quotas

import (
	"context"
	"errors"
	"fmt"
	"sync"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

var ErrQuotaExceeded = errors.New("quota exceeded")

//go:generate mockery --name QuotaChecker --structname MockQuotaChecker --inpackage --filename quota_checker_mock.go --with-expecter

// QuotaChecker checks resource quota and tracks resource creation and deletion
type QuotaChecker interface {
	// GrantResourceCreation checks if a new resource can be created and executes the create function.
	// If the quota check passes, it runs createFn and updates the quota tracker on success.
	// Returns an error if the quota check fails, if createFn returns an error, or if quota tracking fails.
	GrantResourceCreation(ctx context.Context, createFn func() error) error

	// OnResourceDeleted updates the quota tracker when a resource is deleted.
	// This should be called after a resource is successfully deleted.
	OnResourceDeleted(ctx context.Context) error
}

// QuotaCheckerFactory creates QuotaChecker instances based on a repository object
type QuotaCheckerFactory interface {
	// GetQuotaChecker creates a QuotaChecker for the given repository
	GetQuotaChecker(ctx context.Context, repo repository.Reader) (QuotaChecker, error)
}

// UnlimitedQuotaChecker is a QuotaChecker implementation that always allows resource creation
// and does not track resource counts
type UnlimitedQuotaChecker struct{}

// NewUnlimitedQuotaChecker creates a new UnlimitedQuotaChecker
func NewUnlimitedQuotaChecker() *UnlimitedQuotaChecker {
	return &UnlimitedQuotaChecker{}
}

// GrantResourceCreation runs the create function without quota checks for UnlimitedQuotaChecker
func (u *UnlimitedQuotaChecker) GrantResourceCreation(ctx context.Context, createFn func() error) error {
	return createFn()
}

// OnResourceDeleted is a no-op for UnlimitedQuotaChecker as it doesn't track resources
func (u *UnlimitedQuotaChecker) OnResourceDeleted(ctx context.Context) error {
	return nil
}

// UnlimitedQuotaCheckerFactory is a QuotaCheckerFactory implementation that always returns UnlimitedQuotaChecker
type UnlimitedQuotaCheckerFactory struct{}

// NewUnlimitedQuotaCheckerFactory creates a new UnlimitedQuotaCheckerFactory
func NewUnlimitedQuotaCheckerFactory() *UnlimitedQuotaCheckerFactory {
	return &UnlimitedQuotaCheckerFactory{}
}

// GetQuotaChecker returns an UnlimitedQuotaChecker for any repository
func (f *UnlimitedQuotaCheckerFactory) GetQuotaChecker(ctx context.Context, repo repository.Reader) (QuotaChecker, error) {
	return NewUnlimitedQuotaChecker(), nil
}

// fixedLimitQuotaChecker implements QuotaChecker with a fixed maximum limit of resources.
// It tracks granted resources (pending creation) and used resources.
// Free resources are calculated from limits, usage, and granted resources.
type fixedLimitQuotaChecker struct {
	mu          sync.Mutex
	quotaUsage  Usage
	quotaStatus provisioning.QuotaStatus
	granted     int64 // Resources granted but not yet used (pending creation)
}

// NewFixedLimitQuotaChecker creates a new FixedLimitQuotaChecker with the given quota status.
func NewFixedLimitQuotaChecker(quotaUsage Usage, quotaStatus provisioning.QuotaStatus) QuotaChecker {
	return &fixedLimitQuotaChecker{
		quotaUsage:  quotaUsage,
		quotaStatus: quotaStatus,
		granted:     0,
	}
}

// calculateFree calculates the number of free resources available.
// Free = max(status.MaxResourcesPerRepository - usage.TotalResources - granted, 0)
func (f *fixedLimitQuotaChecker) calculateFree() int64 {
	return max(f.quotaStatus.MaxResourcesPerRepository-f.quotaUsage.TotalResources-f.granted, 0)
}

// GrantResourceCreation checks if a new resource can be created, grants the resource,
// executes the create function, and updates the quota tracker based on the result.
// If creation fails, the granted resource is automatically freed via defer.
func (f *fixedLimitQuotaChecker) GrantResourceCreation(ctx context.Context, createFn func() error) error {
	f.mu.Lock()
	// Check if we have free resources available
	if f.calculateFree() <= 0 {
		f.mu.Unlock()
		return ErrQuotaExceeded
	}

	// Grant the resource: increment granted
	f.granted++
	resourceGranted := true
	f.mu.Unlock()

	// Defer to cancel the grant if creation fails
	defer func() {
		f.mu.Lock()
		defer f.mu.Unlock()
		if resourceGranted {
			// Creation failed, cancel the grant: decrement granted
			f.granted--
		}
	}()

	// Execute the creation function
	err := createFn()
	if err != nil {
		// Creation failed, the defer will handle canceling the grant
		return err
	}

	// Creation succeeded: convert granted to used
	f.mu.Lock()
	f.granted--
	f.quotaUsage.TotalResources++
	resourceGranted = false // Prevent defer from canceling
	f.mu.Unlock()

	return nil
}

// OnResourceDeleted frees up a resource when it's deleted.
// It decrements the used resource count.
func (f *fixedLimitQuotaChecker) OnResourceDeleted(ctx context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	// Free up a resource: decrement used
	if f.quotaUsage.TotalResources > 0 {
		f.quotaUsage.TotalResources--
	}

	return nil
}

// ResourceLister is an interface for listing resources and getting stats.
// This interface is defined here to avoid import cycles with the resources package.
type ResourceLister interface {
	Stats(ctx context.Context, namespace, repository string) (*provisioning.ResourceStats, error)
}

// repositoryQuotaCheckerFactory implements QuotaCheckerFactory and creates quota checkers
// based on quota limits from the repository status.
type repositoryQuotaCheckerFactory struct {
	resourceLister ResourceLister
}

// NewRepositoryQuotaCheckerFactory creates a new repositoryQuotaCheckerFactory.
func NewRepositoryQuotaCheckerFactory(
	resourceLister ResourceLister,
) QuotaCheckerFactory {
	return &repositoryQuotaCheckerFactory{
		resourceLister: resourceLister,
	}
}

// GetQuotaChecker creates a QuotaChecker for the given repository.
// Returns a FixedLimitQuotaChecker if quota limits are configured,
// and an UnlimitedQuotaChecker if no limits are set (MaxResources == 0).
func (f *repositoryQuotaCheckerFactory) GetQuotaChecker(ctx context.Context, repo repository.Reader) (QuotaChecker, error) {
	config := repo.Config()
	quotaStatus := config.Status.Quota

	// If no limits are configured, return unlimited checker
	if quotaStatus.MaxResourcesPerRepository == 0 {
		return NewUnlimitedQuotaChecker(), nil
	}

	// Get repository-specific stats
	namespace := config.GetNamespace()
	repoName := config.GetName()
	stats, err := f.resourceLister.Stats(ctx, namespace, repoName)

	var repoStats []provisioning.ResourceCount
	switch {
	case err != nil:
		return nil, err
	case stats == nil:
		return nil, fmt.Errorf("stats are nil")
	case len(stats.Managed) == 1:
		repoStats = stats.Managed[0].Stats
	default:
		return nil, fmt.Errorf("unexpected number of managed stats: %d", len(stats.Managed))
	}

	quotaUsage := NewQuotaUsageFromStats(repoStats)
	return NewFixedLimitQuotaChecker(quotaUsage, quotaStatus), nil
}
