package usagestats

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

type UsageStatsMock struct {
	T            *testing.T
	MetricsFuncs []MetricsFunc
}

func (usm *UsageStatsMock) RegisterMetricsFunc(fn MetricsFunc) {
	usm.MetricsFuncs = append(usm.MetricsFuncs, fn)
}

func (usm *UsageStatsMock) GetUsageReport(_ context.Context) (Report, error) {
	all := make(map[string]interface{})
	for _, fn := range usm.MetricsFuncs {
		fnMetrics, err := fn()
		require.NoError(usm.T, err)

		for name, value := range fnMetrics {
			all[name] = value
		}
	}
	return Report{Metrics: all}, nil
}

func (usm *UsageStatsMock) ShouldBeReported(_ string) bool {
	return true
}

func (usm *UsageStatsMock) RegisterSendReportCallback(_ SendReportCallbackFunc) {}
