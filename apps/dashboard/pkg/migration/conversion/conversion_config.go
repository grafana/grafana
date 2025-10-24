package conversion

import (
	"context"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// ConversionConfig holds the configuration for which conversions are enabled
type ConversionConfig struct {
	// V1 to V2 conversions
	V1ToV2Alpha1Enabled bool
	V1ToV2Beta1Enabled  bool

	// V0 to V2 conversions
	V0ToV2Alpha1Enabled bool
	V0ToV2Beta1Enabled  bool

	// V2 to V1 conversions
	V2Alpha1ToV1Enabled bool
	V2Beta1ToV1Enabled  bool

	// V2 to V0 conversions
	V2Alpha1ToV0Enabled bool
	V2Beta1ToV0Enabled  bool
}

// NewConversionConfig creates a new conversion config based on feature toggles
func NewConversionConfig(ctx context.Context, features featuremgmt.FeatureToggles) *ConversionConfig {
	return &ConversionConfig{
		V1ToV2Alpha1Enabled: features.IsEnabled(ctx, featuremgmt.FlagDashboardV2SchemaAPI),
		V1ToV2Beta1Enabled:  features.IsEnabled(ctx, featuremgmt.FlagDashboardV2SchemaAPI),
		V0ToV2Alpha1Enabled: features.IsEnabled(ctx, featuremgmt.FlagDashboardV2SchemaAPI),
		V0ToV2Beta1Enabled:  features.IsEnabled(ctx, featuremgmt.FlagDashboardV2SchemaAPI),
		V2Alpha1ToV1Enabled: features.IsEnabled(ctx, featuremgmt.FlagDashboardV2SchemaAPI),
		V2Beta1ToV1Enabled:  features.IsEnabled(ctx, featuremgmt.FlagDashboardV2SchemaAPI),
		V2Alpha1ToV0Enabled: features.IsEnabled(ctx, featuremgmt.FlagDashboardV2SchemaAPI),
		V2Beta1ToV0Enabled:  features.IsEnabled(ctx, featuremgmt.FlagDashboardV2SchemaAPI),
	}
}
