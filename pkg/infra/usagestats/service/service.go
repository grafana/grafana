package service

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/setting"
)

type UsageStats struct {
	Cfg           *setting.Cfg
	kvStore       *kvstore.NamespacedKVStore
	RouteRegister routing.RouteRegister
	accesscontrol ac.AccessControl

	log    log.Logger
	tracer tracing.Tracer

	externalMetrics     []usagestats.MetricsFunc
	sendReportCallbacks []usagestats.SendReportCallbackFunc
}

func ProvideService(cfg *setting.Cfg,
	kvStore kvstore.KVStore,
	routeRegister routing.RouteRegister,
	tracer tracing.Tracer,
	accesscontrol ac.AccessControl,
	accesscontrolService ac.Service,
	bundleRegistry supportbundles.Service,
) (*UsageStats, error) {
	s := &UsageStats{
		Cfg:           cfg,
		RouteRegister: routeRegister,
		kvStore:       kvstore.WithNamespace(kvStore, 0, "infra.usagestats"),
		log:           log.New("infra.usagestats"),
		tracer:        tracer,
		accesscontrol: accesscontrol,
	}

	if err := declareFixedRoles(accesscontrolService); err != nil {
		return nil, err
	}

	s.registerAPIEndpoints()
	bundleRegistry.RegisterSupportItemCollector(s.supportBundleCollector())

	return s, nil
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

func (uss *UsageStats) supportBundleCollector() supportbundles.Collector {
	return supportbundles.Collector{
		UID:               "usage-stats",
		DisplayName:       "Usage statistics",
		Description:       "Usage statistics of the Grafana instance",
		IncludedByDefault: false,
		Default:           true,
		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
			report, err := uss.GetUsageReport(context.Background())
			if err != nil {
				return nil, err
			}

			data, err := json.MarshalIndent(report, "", " ")
			if err != nil {
				return nil, err
			}
			return &supportbundles.SupportItem{
				Filename:  "usage-stats.json",
				FileBytes: data,
			}, nil
		},
	}
}
