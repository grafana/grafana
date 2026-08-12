package usagestats

import "context"

type NoopUsageStats struct{}

var _ Service = &NoopUsageStats{}

func (usm *NoopUsageStats) RegisterMetricsFunc(_ MetricsFunc) {}

func (usm *NoopUsageStats) GetUsageReport(_ context.Context) (Report, error) {
	return Report{}, nil
}

func (usm *NoopUsageStats) RegisterSendReportCallback(_ SendReportCallbackFunc) {}

func (usm *NoopUsageStats) SetReadyToReport(_ context.Context) {}
