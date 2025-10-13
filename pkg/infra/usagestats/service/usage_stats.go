package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
)

const (
	maxConcurrentCollectors  = 5
	collectorTimeoutDuration = 5 * time.Minute
)

var usageStatsURL = "https://stats.grafana.org/grafana-usage-report"

func (uss *UsageStats) GetUsageReport(ctx context.Context) (usagestats.Report, error) {
	version := strings.ReplaceAll(uss.Cfg.BuildVersion, ".", "_")
	metrics := sync.Map{}
	start := time.Now()

	edition := "oss"
	if uss.Cfg.IsEnterprise {
		edition = "enterprise"
	}

	report := usagestats.Report{
		Version:      version,
		Os:           runtime.GOOS,
		Arch:         runtime.GOARCH,
		Edition:      edition,
		Packaging:    uss.Cfg.Packaging,
		UsageStatsId: uss.GetUsageStatsId(ctx),
	}

	uss.gatherMetrics(ctx, &metrics)

	// must run after registration of external metrics
	if v, ok := metrics.Load("stats.valid_license.count"); ok {
		report.HasValidLicense = v == 1
	} else {
		metrics.Store("stats.valid_license.count", 0)
	}

	report.Metrics = make(map[string]any)
	metricCount := 0
	metrics.Range(func(key, value any) bool {
		report.Metrics[key.(string)] = value
		metricCount++
		return true
	})

	uss.log.FromContext(ctx).Debug("Collected usage stats", "metricCount", metricCount, "version", report.Version, "os", report.Os, "arch", report.Arch, "edition", report.Edition, "duration", time.Since(start))
	return report, nil
}

func (uss *UsageStats) gatherMetrics(ctx context.Context, metrics *sync.Map) {
	ctxTracer, span := uss.tracer.Start(ctx, "UsageStats.GatherLoop")
	defer span.End()
	var totC, errC uint64

	sem := make(chan struct{}, maxConcurrentCollectors) // create a semaphore with a capacity of 5
	var wg sync.WaitGroup

	for _, fn := range uss.externalMetrics {
		wg.Add(1)
		go func(fn func(context.Context) (map[string]any, error)) {
			defer wg.Done()

			sem <- struct{}{}        // acquire a token
			defer func() { <-sem }() // release the token when done

			ctxWithTimeout, cancel := context.WithTimeout(ctxTracer, collectorTimeoutDuration)
			defer cancel()

			fnMetrics, err := uss.runMetricsFunc(ctxWithTimeout, fn)
			atomic.AddUint64(&totC, 1)
			if err != nil {
				atomic.AddUint64(&errC, 1)
				return
			}

			for name, value := range fnMetrics {
				metrics.Store(name, value)
			}
		}(fn)
	}

	wg.Wait()
	metrics.Store("stats.usagestats.debug.collect.total.count", totC)
	metrics.Store("stats.usagestats.debug.collect.error.count", errC)
}

func (uss *UsageStats) runMetricsFunc(ctx context.Context, fn usagestats.MetricsFunc) (map[string]any, error) {
	start := time.Now()
	ctx, span := uss.tracer.Start(ctx, "UsageStats.Gather")
	fnName := runtime.FuncForPC(reflect.ValueOf(fn).Pointer()).Name()
	span.SetAttributes(attribute.String("usageStats.function", fnName))
	defer span.End()

	fnMetrics, err := fn(ctx)
	if err != nil {
		uss.log.FromContext(ctx).Error("Failed to fetch usage stats from provider", "error", err, "duration", time.Since(start), "function", fnName)
		span.SetStatus(codes.Error, fmt.Sprintf("failed to fetch usage stats from provider: %v", err))
		return nil, err
	}

	uss.log.FromContext(ctx).Debug("Successfully fetched usage stats from provider", "duration", time.Since(start), "function", fnName)
	return fnMetrics, nil
}

func (uss *UsageStats) RegisterMetricsFunc(fn usagestats.MetricsFunc) {
	uss.externalMetrics = append(uss.externalMetrics, fn)
}

func (uss *UsageStats) sendUsageStats(ctx context.Context) (string, error) {
	if !uss.Cfg.ReportingEnabled {
		return "", nil
	}
	ctx, span := uss.tracer.Start(ctx, "UsageStats.BackgroundJob")
	defer span.End()
	traceID := tracing.TraceIDFromContext(ctx, false)
	uss.log.FromContext(ctx).Debug("Sending anonymous usage stats", "url", usageStatsURL)
	start := time.Now()

	report, err := uss.GetUsageReport(ctx)
	if err != nil {
		return traceID, err
	}

	out, err := json.MarshalIndent(report, "", " ")
	if err != nil {
		return traceID, err
	}

	data := bytes.NewBuffer(out)
	err = sendUsageStats(uss, ctx, data)
	if err != nil {
		return traceID, err
	}

	uss.log.FromContext(ctx).Info("Sent usage stats", "duration", time.Since(start))
	return traceID, nil
}

// sendUsageStats sends usage statistics.
//
// Stubbable by tests.
var sendUsageStats = func(uss *UsageStats, ctx context.Context, data *bytes.Buffer) error {
	ctx, span := uss.tracer.Start(ctx, "UsageStats.Send")
	defer span.End()

	client := http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, usageStatsURL, data)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("failed to create request for usage stats: %v", err))
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	uss.tracer.Inject(ctx, req.Header, span)
	resp, err := client.Do(req)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("failed to send usage stats: %v", err))
		return err
	}
	if err := resp.Body.Close(); err != nil {
		uss.log.FromContext(ctx).Warn("Failed to close response body after sending usage stats", "err", err)
	}
	return nil
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
