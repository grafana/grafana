package usagestats

import (
	"context"
)

type Report struct {
	Version         string                 `json:"version"`
	Metrics         map[string]interface{} `json:"metrics"`
	Os              string                 `json:"os"`
	Arch            string                 `json:"arch"`
	Edition         string                 `json:"edition"`
	HasValidLicense bool                   `json:"hasValidLicense"`
	Packaging       string                 `json:"packaging"`
	UsageStatsId    string                 `json:"usageStatsId"`
}

type MetricsFunc func(context.Context) (map[string]interface{}, error)

type SendReportCallbackFunc func()

type Service interface {
	GetUsageReport(context.Context) (Report, error)
	RegisterMetricsFunc(MetricsFunc)
	RegisterSendReportCallback(SendReportCallbackFunc)
}
