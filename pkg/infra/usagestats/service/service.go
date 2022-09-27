package service

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type UsageStats struct {
	Cfg           *setting.Cfg
	kvStore       *kvstore.NamespacedKVStore
	RouteRegister routing.RouteRegister
	pluginStore   plugins.Store

	log    log.Logger
	tracer tracing.Tracer

	externalMetrics     []usagestats.MetricsFunc
	sendReportCallbacks []usagestats.SendReportCallbackFunc
}

func ProvideService(cfg *setting.Cfg, pluginStore plugins.Store, kvStore kvstore.KVStore, routeRegister routing.RouteRegister, tracer tracing.Tracer) *UsageStats {
	s := &UsageStats{
		Cfg:           cfg,
		RouteRegister: routeRegister,
		pluginStore:   pluginStore,
		kvStore:       kvstore.WithNamespace(kvStore, 0, "infra.usagestats"),
		log:           log.New("infra.usagestats"),
		tracer:        tracer,
	}

	s.registerAPIEndpoints()

	return s
}

func (uss *UsageStats) Run(ctx context.Context) error {
	// try to load last sent time from kv store
	lastSent := time.Now()
	if val, ok, err := uss.kvStore.Get(ctx, "last_sent"); err != nil {
		uss.log.Error("Failed to get last sent time", "error", err)
	} else if ok {
		if parsed, err := time.Parse(time.RFC3339, val); err != nil {
			uss.log.Error("Failed to parse last sent time", "error", err)
		} else {
			lastSent = parsed
		}
	}

	// calculate initial send delay
	sendInterval := time.Hour * 24
	nextSendInterval := time.Until(lastSent.Add(sendInterval))
	if nextSendInterval < time.Minute {
		nextSendInterval = time.Minute
	}

	sendReportTicker := time.NewTicker(nextSendInterval)

	defer sendReportTicker.Stop()

	for {
		select {
		case <-sendReportTicker.C:
			if traceID, err := uss.sendUsageStats(ctx); err != nil {
				uss.log.Warn("Failed to send usage stats", "error", err, "traceID", traceID)
			}

			lastSent = time.Now()
			if err := uss.kvStore.Set(ctx, "last_sent", lastSent.Format(time.RFC3339)); err != nil {
				uss.log.Warn("Failed to update last sent time", "error", err)
			}

			if nextSendInterval != sendInterval {
				nextSendInterval = sendInterval
				sendReportTicker.Reset(nextSendInterval)
			}

			for _, callback := range uss.sendReportCallbacks {
				callback()
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (uss *UsageStats) RegisterSendReportCallback(c usagestats.SendReportCallbackFunc) {
	uss.sendReportCallbacks = append(uss.sendReportCallbacks, c)
}

func (uss *UsageStats) ShouldBeReported(ctx context.Context, dsType string) bool {
	ds, exists := uss.pluginStore.Plugin(ctx, dsType)
	if !exists {
		return false
	}

	return ds.Signature.IsValid() || ds.Signature.IsInternal()
}
