package conversion

import (
	"context"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// ConversionConfig holds the configuration for which conversions are enabled
type ConversionConfig struct {
	dashboardV2SchemaAPIEnabled bool
}

// NewConversionConfig creates a new conversion config based on feature toggles
func NewConversionConfig(ctx context.Context, features featuremgmt.FeatureToggles) *ConversionConfig {
	return &ConversionConfig{
		dashboardV2SchemaAPIEnabled: features.IsEnabled(ctx, featuremgmt.FlagDashboardV2SchemaAPI),
	}
}
