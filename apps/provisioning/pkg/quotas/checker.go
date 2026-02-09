package quotas

import (
	"context"
	"errors"
	"fmt"
	"sync"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

var ErrQuotaExceeded = errors.New("quota exceeded")

// ResourceCounter provides resource counting for quota enforcement.
// It is independent from any implemented resource lister to avoid dependency cycles.
type ResourceCounter interface {
	Count(ctx context.Context, namespace, repository string) (int64, error)
}

// QuotaChecker validates whether a resource operation is within quota.
//
//go:generate mockery --name QuotaChecker --structname MockQuotaChecker --inpackage --filename quota_checker_mock.go --with-expecter
type QuotaChecker interface {
	// GrantResourceCreation checks if a new resource can be created and executes the create function.
	GrantResourceCreation(ctx context.Context, createFn func() error) error

	// OnResourceDeleted updates the tracked quota when a resource is deleted.
	OnResourceDeleted(ctx context.Context) error
}

// QuotaCheckerFactory creates QuotaCheckers scoped to a specific repository.
//
//go:generate mockery --name QuotaCheckerFactory --structname MockQuotaCheckerFactory --inpackage --filename quota_checker_factory_mock.go --with-expecter
type QuotaCheckerFactory interface {
	GetQuotaChecker(ctx context.Context, quotaStatus provisioning.QuotaStatus, namespace, repository string) (QuotaChecker, error)
}

type quotaCheckerFactory struct {
	resourceCounter ResourceCounter
}

// NewQuotaCheckerFactory creates a new QuotaCheckerFactory using a resource counter.
func NewQuotaCheckerFactory(counter ResourceCounter) QuotaCheckerFactory {
	return &quotaCheckerFactory{
		resourceCounter: counter,
	}
}

// GetQuotaChecker creates a QuotaChecker for the given namespace and repository.
// It uses the provided quota status and fetches current resource stats, returning a checker
// that can evaluate whether the quota is exceeded.
func (f *quotaCheckerFactory) GetQuotaChecker(ctx context.Context, quotaStatus provisioning.QuotaStatus, namespace, repository string) (QuotaChecker, error) {
	// Fetch current resource count for this repo
	count, err := f.resourceCounter.Count(ctx, namespace, repository)
	if err != nil {
		return nil, fmt.Errorf("get resource stats for quota check: %w", err)
	}

	return &resourcesQuotaChecker{
		quotaStatus: quotaStatus,
		quotaUsage:  Usage{TotalResources: count},
		granted:     0,
	}, nil
}

// resourcesQuotaChecker holds a snapshot of quota limits and current resource counts,
// and evaluates whether the quota is exceeded. It tracks in-flight grants to prevent
// race conditions when multiple resources are created concurrently.
type resourcesQuotaChecker struct {
	mu          sync.Mutex
	quotaStatus provisioning.QuotaStatus
	quotaUsage  Usage
	granted     int64 // tracks in-flight grants (resources being created but not yet committed)
}

func (f *resourcesQuotaChecker) GrantResourceCreation(ctx context.Context, createFn func() error) error {
	f.mu.Lock()
	if !f.shouldGrant() {
		f.mu.Unlock()
		return ErrQuotaExceeded
	}

	f.granted++
	resourceGranted := true

	// Defer immediately (still holds separate resourceGranted per-call)
	defer func() {
		f.mu.Lock()
		defer f.mu.Unlock()
		if resourceGranted {
			f.granted--
		}
	}()

	f.mu.Unlock()

	if err := createFn(); err != nil {
		return err
	}

	f.mu.Lock()
	f.granted--
	f.quotaUsage.TotalResources++
	resourceGranted = false
	f.mu.Unlock()

	return nil
}

// shouldGrant calculates if a new resource can be created.
func (f *resourcesQuotaChecker) shouldGrant() bool {
	// If quota is unlimited (0), always allow
	if f.quotaStatus.MaxResourcesPerRepository == 0 {
		return true
	}
	return max(f.quotaStatus.MaxResourcesPerRepository-f.quotaUsage.TotalResources-f.granted, 0) > 0
}

// OnResourceDeleted frees up a resource when it's deleted.
// It decrements the used resource count.
func (f *resourcesQuotaChecker) OnResourceDeleted(ctx context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.quotaUsage.TotalResources > 0 {
		f.quotaUsage.TotalResources--
	}

	return nil
}

// unlimitedQuotaChecker is a no-op quota checker that always allows operations.
// It's used when quota checking is not needed or disabled.
type unlimitedQuotaChecker struct{}

// GrantResourceCreation always allows resource creation without checking quota.
func (u *unlimitedQuotaChecker) GrantResourceCreation(ctx context.Context, createFn func() error) error {
	return createFn()
}

// OnResourceDeleted is a no-op for unlimited quota checker.
func (u *unlimitedQuotaChecker) OnResourceDeleted(ctx context.Context) error {
	return nil
}

// unlimitedQuotaCheckerFactory creates unlimited quota checkers.
type unlimitedQuotaCheckerFactory struct{}

// NewUnlimitedQuotaCheckerFactory creates a factory that returns unlimited quota checkers.
func NewUnlimitedQuotaCheckerFactory() QuotaCheckerFactory {
	return &unlimitedQuotaCheckerFactory{}
}

// GetQuotaChecker returns an unlimited quota checker that always allows operations.
func (f *unlimitedQuotaCheckerFactory) GetQuotaChecker(ctx context.Context, _ provisioning.QuotaStatus, _, _ string) (QuotaChecker, error) {
	return &unlimitedQuotaChecker{}, nil
}
