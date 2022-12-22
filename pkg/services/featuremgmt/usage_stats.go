package featuremgmt

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/featuremgmt/strcase"
)

func (fm *FeatureManager) GetUsageStats(ctx context.Context) map[string]interface{} {
	enabled := fm.GetEnabled(ctx)
	stats := make(map[string]interface{}, len(enabled))
	for featureName := range enabled {
		stats[asMetricName(featureName)] = 1
	}
	return stats
}

func asMetricName(featureName string) string {
	return fmt.Sprintf("stats.features.%s.count", strcase.ToSnake(featureName))
}
