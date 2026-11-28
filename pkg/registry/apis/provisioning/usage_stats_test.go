package provisioning

import (
	"testing"
	"testing/synctest"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/setting"
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
		name                string
		builder             *APIBuilder
		usageStats          usagestats.Service
		controllersDisabled bool
		disabled            bool
	}{
		{name: "provisioning disabled", usageStats: stats, disabled: true},
		{name: "controllers disabled", builder: &APIBuilder{}, usageStats: stats, controllersDisabled: true, disabled: false},
		{name: "no usage stats service", builder: &APIBuilder{}, disabled: true},
		{name: "enabled", builder: &APIBuilder{}, usageStats: stats, disabled: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			svc := ProvideUsageStatsService(&setting.Cfg{DisableControllers: tc.controllersDisabled}, tc.builder, tc.usageStats, nil, tracing.NewNoopTracerService())
			assert.Equal(t, tc.disabled, svc.IsDisabled())
			assert.Equal(t, UsageStatsServiceName, svc.ServiceName())
		})
	}
}

func TestUsageStatsService_Run(t *testing.T) {
	t.Run("registers the collector once the provisioning API is served", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			stats := &countingUsageStats{}
			builder := &APIBuilder{loopbackReady: make(chan struct{}), repoLister: nopRepoLister{}}
			svc := ProvideUsageStatsService(&setting.Cfg{}, builder, stats, nil, tracing.NewNoopTracerService())
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()

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
