package features

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	FlagCloudWatchCrossAccountQuerying = "cloudWatchCrossAccountQuerying"
	FlagCloudWatchBatchQueries         = "cloudWatchBatchQueries"
)

func IsEnabled(ctx context.Context, feature string) bool {
	return backend.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled(feature)
}
