package quotas

import (
	"context"
)

//go:generate mockery --name NamespaceLimitsProvider --structname MockNamespaceLimitsProvider --inpackage --filename namespace_limits_provider_mock.go --with-expecter

// NamespaceLimitsProvider provides repository limits for a given namespace
type NamespaceLimitsProvider interface {
	GetMaxRepositories(ctx context.Context, namespace string) (int, error)
}

// FixedNamespaceLimitsProvider returns a fixed limit for all namespaces
type FixedNamespaceLimitsProvider struct {
	limit int
}

// NewFixedNamespaceLimitsProvider creates a new FixedNamespaceLimitsProvider with the specified limit
func NewFixedNamespaceLimitsProvider(limit int) *FixedNamespaceLimitsProvider {
	return &FixedNamespaceLimitsProvider{limit: limit}
}

// GetMaxRepositories returns the fixed limit for any namespace
func (f *FixedNamespaceLimitsProvider) GetMaxRepositories(ctx context.Context, namespace string) (int, error) {
	return f.limit, nil
}
