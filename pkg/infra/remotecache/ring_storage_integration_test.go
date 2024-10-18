package remotecache

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/remotecache/ring"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func TestIntegrationRingCacheStorage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	opts := &setting.RemoteCacheSettings{
		Name:       ring.CacheType,
		Prefix:     "",
		Encryption: false,
		Ring: setting.RemoteCacheRingSettings{
			Addr: "127.0.0.1",
			Port: 5093,
		},
	}

	cfg := &setting.Cfg{
		RemoteCache:       opts,
		GRPCServerAddress: "127.0.0.1:5092",
		GRPCServerNetwork: "tcp",
	}

	testTracer := tracing.InitializeTracerForTest()
	grpcServer, err := grpcserver.ProvideService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagGrpcServer), noopAuthenticator{},
		testTracer, prometheus.DefaultRegisterer)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())

	t.Cleanup(cancel)

	client := createTestClient(t, cfg, nil, grpcServer)

	go func(ctx context.Context) {
		_ = client.Run(ctx)
	}(ctx)

	// Wait for the server to start
	time.Sleep(100 * time.Millisecond)

	go func(ctx context.Context) {
		_ = grpcServer.Run(ctx)
	}(ctx)

	// Wait for the server to start
	time.Sleep(100 * time.Millisecond)

	runTestsForClient(t, client)
}
