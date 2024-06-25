package features

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	FlagCloudWatchCrossAccountQuerying = "cloudWatchCrossAccountQuerying"
	FlagCloudWatchBatchQueries         = "cloudWatchBatchQueries"
	FlagCloudWatchNewLabelParsing      = "cloudWatchNewLabelParsing"
	FlagCloudWatchRoundUpEndTime       = "cloudWatchRoundUpEndTime"
)

func IsEnabled(ctx context.Context, feature string) bool {
	return backend.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled(feature)
}
