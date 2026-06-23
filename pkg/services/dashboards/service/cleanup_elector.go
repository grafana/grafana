package service

import (
	"fmt"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/leaderelection/kvlease"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// CleanupElector is the leader-election Elector dedicated to the k8s dashboard
// cleanup background job. It is a distinct type rather than the bare
// leaderelection.Elector interface so the Wire graph can provide it without
// colliding with other Elector bindings (e.g. zanzana's).
type CleanupElector struct {
	leaderelection.Elector
}

// ProvideDashboardCleanupElector builds the Elector that gates the k8s dashboard
// cleanup job.
//
// When leader election is disabled (the default) it returns a DefaultElector and
// the cleanup job keeps its existing serverlock-based coordination, where every
// instance contends a shared row each interval. When enabled it returns a
// KV-lease elector: a single instance holds a renewable lease and runs the
// cleanup loop, removing the per-interval, fleet-wide serverlock contention.
func ProvideDashboardCleanupElector(cfg *setting.Cfg, kvStore kv.KV, reg prometheus.Registerer) (*CleanupElector, error) {
	if !cfg.K8sDashboardCleanup.LeaderElection.Enabled {
		return &CleanupElector{Elector: leaderelection.NewDefaultElector()}, nil
	}

	if kvStore == nil {
		return nil, fmt.Errorf("dashboard cleanup leader election requires the unified storage KV backend")
	}

	le, err := kvlease.New(kvStore, cfg.K8sDashboardCleanup.LeaderElection, log.New("dashboard-cleanup"), reg)
	if err != nil {
		return nil, fmt.Errorf("failed to create dashboard cleanup KV lease elector: %w", err)
	}
	return &CleanupElector{Elector: le}, nil
}
