package provisioning

import (
	"context"
	"testing"
	"testing/synctest"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/usagestats"
)

type countingUsageStats struct {
	usagestats.UsageStatsMock
	registered int
}

func (c *countingUsageStats) RegisterMetricsFunc(fn usagestats.MetricsFunc) {
	c.registered++
	c.UsageStatsMock.RegisterMetricsFunc(fn)
}

// nopRepoLister lets the collector be built; it is never called here.
type nopRepoLister struct {
	repository.RepositoryByConnectionLister
}

func TestUsageStatsService_IsDisabled(t *testing.T) {
	stats := &countingUsageStats{}
	tests := []struct {
		name     string
		builder  *APIBuilder
		disabled bool
	}{
		{name: "provisioning disabled", builder: nil, disabled: true},
		{name: "controllers disabled", builder: &APIBuilder{onlyApiServer: true, isPreferredVersion: true, usageStats: stats}, disabled: true},
		{name: "not the preferred version", builder: &APIBuilder{usageStats: stats}, disabled: true},
		{name: "no usage stats service", builder: &APIBuilder{isPreferredVersion: true}, disabled: true},
		{name: "enabled", builder: &APIBuilder{isPreferredVersion: true, usageStats: stats}, disabled: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			svc := ProvideUsageStatsService(tc.builder)
			assert.Equal(t, tc.disabled, svc.IsDisabled())
			assert.Equal(t, UsageStatsServiceName, svc.ServiceName())
		})
	}
}

func TestUsageStatsService_Run(t *testing.T) {
	t.Run("registers the collector once the provisioning API is served", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			stats := &countingUsageStats{}
			builder := &APIBuilder{loopbackReady: make(chan struct{}), isPreferredVersion: true, usageStats: stats, repoLister: nopRepoLister{}}
			svc := ProvideUsageStatsService(builder)
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(context.Background()) }()

			synctest.Wait()
			assert.Zero(t, stats.registered)

			builder.publishLoopbackConfig(&clientrest.Config{})
			synctest.Wait()
			assert.Equal(t, 1, stats.registered)

			svc.StopAsync()
			require.NoError(t, <-runErr)
			require.Equal(t, services.Terminated, svc.State())
		})
	})
}
