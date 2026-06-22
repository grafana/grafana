package setting

import (
	"time"

	"github.com/grafana/grafana/pkg/infra/leaderelection"
)

type K8sDashboardCleanupSettings struct {
	Interval  time.Duration
	Timeout   time.Duration
	BatchSize int64
	// LeaderElection, when enabled, makes a single instance hold a renewable
	// lease and run the cleanup loop, instead of every instance contending the
	// shared serverlock row each interval. Disabled by default.
	LeaderElection leaderelection.Config
}

const (
	defaultK8sDashboardCleanupInterval      = 30 * time.Second
	defaultK8sDashboardCleanupBatchSize     = int64(10)
	minK8sDashboardCleanupInterval          = 10 * time.Second
	minK8sDashboardCleanupTimeout           = 5 * time.Second
	minK8sDashboardCleanupBatchSize         = int64(5)
	maxK8sDashboardCleanupBatchSize         = int64(200)
	defaultK8sDashboardCleanupLeaseName     = "dashboard-cleanup"
	defaultK8sDashboardCleanupLeaseDuration = 15 * time.Second
	defaultK8sDashboardCleanupRetryPeriod   = 15 * time.Second
)

func (cfg *Cfg) readK8sDashboardCleanupSettings() {
	section := cfg.Raw.Section("dashboard_cleanup")

	// Read interval setting with validation
	cleanupInterval := section.Key("interval").MustDuration(defaultK8sDashboardCleanupInterval)
	if cleanupInterval < minK8sDashboardCleanupInterval {
		cfg.Logger.Warn("[dashboard_cleanup.interval] is too low; the minimum allowed (10s) is enforced")
		cleanupInterval = minK8sDashboardCleanupInterval
	}

	// Calculate timeout as 5 seconds less than interval, with minimum validation
	cleanupTimeout := cleanupInterval - (5 * time.Second)
	if cleanupTimeout < minK8sDashboardCleanupTimeout {
		cleanupTimeout = minK8sDashboardCleanupTimeout
	}

	// Read batch size with validation
	batchSize := section.Key("batch_size").MustInt64(defaultK8sDashboardCleanupBatchSize)
	if batchSize < minK8sDashboardCleanupBatchSize {
		cfg.Logger.Warn("[dashboard_cleanup.batch_size] is too low; the minimum allowed (5) is enforced")
		batchSize = minK8sDashboardCleanupBatchSize
	} else if batchSize > maxK8sDashboardCleanupBatchSize {
		cfg.Logger.Warn("[dashboard_cleanup.batch_size] is too high; the maximum allowed (1000) is enforced")
		batchSize = maxK8sDashboardCleanupBatchSize
	}

	cfg.K8sDashboardCleanup = K8sDashboardCleanupSettings{
		Interval:  cleanupInterval,
		Timeout:   cleanupTimeout,
		BatchSize: batchSize,
		LeaderElection: leaderelection.Config{
			Enabled:       section.Key("leader_election_enabled").MustBool(false),
			LeaseName:     section.Key("leader_election_lease_name").MustString(defaultK8sDashboardCleanupLeaseName),
			Namespace:     section.Key("leader_election_namespace").MustString(""),
			Identity:      section.Key("leader_election_identity").MustString(""),
			LeaseDuration: section.Key("lease_duration").MustDuration(defaultK8sDashboardCleanupLeaseDuration),
			// RenewDeadline is unused by the KV-lease elector (renewal is internal),
			// but kept for parity with leaderelection.Config / future K8s elector use.
			RenewDeadline: section.Key("renew_deadline").MustDuration(10 * time.Second),
			RetryPeriod:   section.Key("retry_period").MustDuration(defaultK8sDashboardCleanupRetryPeriod),
		},
	}
}
