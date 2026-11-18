package usagestatstest

import (
	"context"
	"maps"
	"testing"

	"github.com/grafana/grafana/pkg/infra/usagestats"

	"github.com/stretchr/testify/require"
)

type UsageStatsMock struct {
	T            testing.TB
	metricsFuncs []usagestats.MetricsFunc
}

func (usm *UsageStatsMock) RegisterMetricsFunc(fn usagestats.MetricsFunc) {
	usm.metricsFuncs = append(usm.metricsFuncs, fn)
}

func (usm *UsageStatsMock) GetUsageReport(ctx context.Context) (usagestats.Report, error) {
	all := make(map[string]any)
	for _, fn := range usm.metricsFuncs {
		fnMetrics, err := fn(ctx)
		require.NoError(usm.T, err)

		maps.Copy(all, fnMetrics)
	}
	return usagestats.Report{Metrics: all}, nil
}

func (usm *UsageStatsMock) RegisterSendReportCallback(_ usagestats.SendReportCallbackFunc) {}

func (usm *UsageStatsMock) SetReadyToReport(_ context.Context) {}
