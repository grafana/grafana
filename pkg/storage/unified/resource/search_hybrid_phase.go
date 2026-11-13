package resource

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
)

type hybridPhaseObserverKey struct{}

func withHybridPhaseObserver(ctx context.Context, metrics *VectorMetrics) context.Context {
	return context.WithValue(ctx, hybridPhaseObserverKey{}, metrics)
}

func hybridPhaseStart(ctx context.Context) time.Time {
	if ctx.Value(hybridPhaseObserverKey{}) == nil {
		return time.Time{}
	}
	return time.Now()
}

func observeHybridPhase(ctx context.Context, phase string, start time.Time, err error) {
	if start.IsZero() {
		return
	}
	metrics := ctx.Value(hybridPhaseObserverKey{}).(*VectorMetrics)
	outcome := "ok"
	if err != nil {
		outcome = "error"
	}
	metricutil.ObserveWithExemplar(ctx, metrics.HybridSearchPhaseDuration.WithLabelValues(phase, outcome), time.Since(start).Seconds())
}
