package acimpl

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type managedPermissionFilteringKey struct{}

// Capture once so cache keys and SQL queries use the same filtering decision
// throughout a permission load, even if the provider changes in the meantime.
func (s *Service) withManagedPermissionFiltering(ctx context.Context) context.Context {
	if _, ok := ctx.Value(managedPermissionFilteringKey{}).(bool); ok {
		return ctx
	}

	return context.WithValue(ctx, managedPermissionFilteringKey{}, s.excludeRedundantManagedPermissions(ctx))
}

func (s *Service) excludeRedundantManagedPermissions(ctx context.Context) bool {
	if enabled, ok := ctx.Value(managedPermissionFilteringKey{}).(bool); ok {
		return enabled
	}

	const defaultExcludeRedundantManagedPermissions = false
	return s.openFeatureClient.Boolean(
		ctx,
		featuremgmt.FlagExcludeRedundantManagedPermissions,
		defaultExcludeRedundantManagedPermissions,
		openfeature.TransactionContext(ctx),
	)
}
