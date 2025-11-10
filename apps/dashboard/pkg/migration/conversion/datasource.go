package conversion

import (
	"context"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

type contextKey string

const datasourceProviderKey contextKey = "datasourceProvider"

// WithDataSourceProvider adds the datasource provider to the context
// This is the same provider instance initialized in register.go
func WithDataSourceProvider(ctx context.Context, provider schemaversion.DataSourceInfoProvider) context.Context {
	return context.WithValue(ctx, datasourceProviderKey, provider)
}

// getDataSourceProvider returns the datasource provider from context
// Matches the migration pattern where provider is always available (captured in closure)
// The provider should be set in context by prepareV1beta1ConversionContext
func getDataSourceProvider(ctx context.Context) schemaversion.DataSourceInfoProvider {
	// Get provider from context (set by prepareV1beta1ConversionContext)
	// This matches migrations where provider is captured in closure
	if provider, ok := ctx.Value(datasourceProviderKey).(schemaversion.DataSourceInfoProvider); ok {
		return provider
	}

	// Fallback to test provider (for tests only)
	if testProvider != nil {
		return testProvider
	}

	return nil
}

// SetTestDataSourceProvider sets a test datasource provider for use in tests
// This is a workaround for tests where context cannot be easily passed through conversion.Scope
var testProvider schemaversion.DataSourceInfoProvider

// SetTestDataSourceProvider sets the test datasource provider
// This should only be used in tests
func SetTestDataSourceProvider(provider schemaversion.DataSourceInfoProvider) {
	testProvider = provider
}

// getDefaultDatasourceRef gets the default datasource type using the datasource provider
// Matches migration pattern: provider is always available (captured in closure for migrations, in context for conversions)
// Uses the same provider instance as migrations (initialized in register.go)
func getDefaultDatasourceRef(ctx context.Context) dashv2alpha1.DashboardDataSourceRef {
	defaultGrafanaUID := "-- Grafana --"
	defaultGrafanaType := "grafana"

	provider := getDataSourceProvider(ctx)
	if provider == nil {
		// Should not happen in normal flow (provider set by prepareV1beta1ConversionContext)
		// Fallback for safety (matches migration pattern where provider is always available)
		return dashv2alpha1.DashboardDataSourceRef{
			Uid:  &defaultGrafanaUID,
			Type: &defaultGrafanaType,
		}
	}

	// Use GetDataSourceInfo directly, same as migrations do: datasources := dsInfo.GetDataSourceInfo(ctx)
	datasources := provider.GetDataSourceInfo(ctx)
	for _, ds := range datasources {
		if ds.Default {
			return dashv2alpha1.DashboardDataSourceRef{
				Uid:  &ds.UID,
				Type: &ds.Type,
			}
		}
	}

	// If no default was found, fallback to Grafana
	return dashv2alpha1.DashboardDataSourceRef{
		Uid:  &defaultGrafanaUID,
		Type: &defaultGrafanaType,
	}
}

// getDatasourceTypeByUID gets the datasource type by UID using the datasource provider
// Matches migration pattern: provider is always available (captured in closure for migrations, in context for conversions)
// Uses the same provider instance as migrations (initialized in register.go)
func getDatasourceTypeByUID(ctx context.Context, uid string) string {
	if uid == "" {
		return *getDefaultDatasourceRef(ctx).Type
	}

	provider := getDataSourceProvider(ctx)
	if provider == nil {
		// Should not happen in normal flow (provider set by prepareV1beta1ConversionContext)
		// Fallback for safety (matches migration pattern where provider is always available)
		return "grafana"
	}

	// Use GetDataSourceInfo directly, same as migrations do: datasources := dsInfo.GetDataSourceInfo(ctx)
	datasources := provider.GetDataSourceInfo(ctx)
	for _, ds := range datasources {
		if ds.UID == uid {
			return ds.Type
		}
	}

	// If not found, return the default type
	return *getDefaultDatasourceRef(ctx).Type
}
