package cloudwatch

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/assert"
)

func TestTimeSeriesQuery(t *testing.T) {
	executor := newExecutor(nil, newTestConfig())

	t.Run("End time before start time should result in error", func(t *testing.T) {
		timeRange := plugins.NewDataTimeRange("now-1h", "now-2h")
		_, err := executor.executeTimeSeriesQuery(
			context.TODO(), plugins.DataQuery{TimeRange: &timeRange})
		assert.EqualError(t, err, "invalid time range: start time must be before end time")
	})

	t.Run("End time equals start time should result in error", func(t *testing.T) {
		timeRange := plugins.NewDataTimeRange("now-1h", "now-1h")
		_, err := executor.executeTimeSeriesQuery(
			context.TODO(), plugins.DataQuery{TimeRange: &timeRange})
		assert.EqualError(t, err, "invalid time range: start time must be before end time")
	})
}
