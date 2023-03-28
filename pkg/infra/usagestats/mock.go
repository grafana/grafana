package usagestats

import (
	"context"
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
	all := make(map[string]interface{})
	for _, fn := range usm.metricsFuncs {
		fnMetrics, err := fn(ctx)
		require.NoError(usm.T, err)

		for name, value := range fnMetrics {
			all[name] = value
		}
	}
	return Report{Metrics: all}, nil
}

func (usm *UsageStatsMock) RegisterSendReportCallback(_ SendReportCallbackFunc) {}
