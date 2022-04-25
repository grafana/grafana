package service

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/infra/usagestats"
)

var usageStatsURL = "https://stats.grafana.org/grafana-usage-report"

func (uss *UsageStats) GetUsageReport(ctx context.Context) (usagestats.Report, error) {
	version := strings.ReplaceAll(uss.Cfg.BuildVersion, ".", "_")

	metrics := map[string]interface{}{}

	edition := "oss"
	if uss.Cfg.IsEnterprise {
		edition = "enterprise"
	}
	report := usagestats.Report{
		Version:      version,
		Metrics:      metrics,
		Os:           runtime.GOOS,
		Arch:         runtime.GOARCH,
		Edition:      edition,
		Packaging:    uss.Cfg.Packaging,
		UsageStatsId: uss.GetUsageStatsId(ctx),
	}

	uss.gatherMetrics(ctx, metrics)

	// must run after registration of external metrics
	if v, ok := metrics["stats.valid_license.count"]; ok {
		report.HasValidLicense = v == 1
	} else {
		metrics["stats.valid_license.count"] = 0
	}

	return report, nil
}

func (uss *UsageStats) gatherMetrics(ctx context.Context, metrics map[string]interface{}) {
	for _, fn := range uss.externalMetrics {
		fnMetrics, err := fn(ctx)
		if err != nil {
			uss.log.Error("Failed to fetch external metrics", "error", err)
			continue
		}

		for name, value := range fnMetrics {
			metrics[name] = value
		}
	}
}

func (uss *UsageStats) RegisterMetricsFunc(fn usagestats.MetricsFunc) {
	uss.externalMetrics = append(uss.externalMetrics, fn)
}

func (uss *UsageStats) sendUsageStats(ctx context.Context) error {
	if !uss.Cfg.ReportingEnabled {
		return nil
	}

	uss.log.Debug("Sending anonymous usage stats", "url", usageStatsURL)

	report, err := uss.GetUsageReport(ctx)
	if err != nil {
		return err
	}

	out, err := json.MarshalIndent(report, "", " ")
	if err != nil {
		return err
	}

	data := bytes.NewBuffer(out)
	sendUsageStats(uss, data)
	return nil
}

// sendUsageStats sends usage statistics.
//
// Stubbable by tests.
var sendUsageStats = func(uss *UsageStats, data *bytes.Buffer) {
	go func() {
		client := http.Client{Timeout: 5 * time.Second}
		resp, err := client.Post(usageStatsURL, "application/json", data)
		if err != nil {
			uss.log.Error("Failed to send usage stats", "err", err)
			return
		}
		if err := resp.Body.Close(); err != nil {
			uss.log.Warn("Failed to close response body", "err", err)
		}
	}()
}

func (uss *UsageStats) GetUsageStatsId(ctx context.Context) string {
	anonId, ok, err := uss.kvStore.Get(ctx, "anonymous_id")
	if err != nil {
		uss.log.Error("Failed to get usage stats id", "error", err)
		return ""
	}

	if ok {
		return anonId
	}

	newId, err := uuid.NewRandom()
	if err != nil {
		uss.log.Error("Failed to generate usage stats id", "error", err)
		return ""
	}

	anonId = newId.String()

	err = uss.kvStore.Set(ctx, "anonymous_id", anonId)
	if err != nil {
		uss.log.Error("Failed to store usage stats id", "error", err)
		return ""
	}

	return anonId
}
