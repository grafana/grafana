package features

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	FlagCloudWatchCrossAccountQuerying    = "cloudWatchCrossAccountQuerying"
	FlagCloudWatchWildCardDimensionValues = "cloudWatchWildCardDimensionValues"
	FlagCloudWatchBatchQueries            = "cloudWatchBatchQueries"
)

func IsEnabled(ctx context.Context, feature string) bool {
	return backend.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled(feature)
}
