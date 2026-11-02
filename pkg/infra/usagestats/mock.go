package usagestats

import (
	"context"
	"maps"
	"testing"

	"github.com/stretchr/testify/require"
)

type UsageStatsMock struct {
	T            testing.TB
	metricsFuncs []MetricsFunc
}

func (usm *UsageStatsMock) RegisterMetricsFunc(fn MetricsFunc) {
	usm.metricsFuncs = append(usm.metricsFuncs, fn)
}

func (usm *UsageStatsMock) GetUsageReport(ctx context.Context) (Report, error) {
	all := make(map[string]any)
	for _, fn := range usm.metricsFuncs {
		fnMetrics, err := fn(ctx)
		require.NoError(usm.T, err)

		maps.Copy(all, fnMetrics)
	}
	return Report{Metrics: all}, nil
}

func (usm *UsageStatsMock) RegisterSendReportCallback(_ SendReportCallbackFunc) {}

func (usm *UsageStatsMock) SetReadyToReport(_ context.Context) {}
