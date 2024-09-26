package remotecache

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/remotecache/ring"
	"github.com/grafana/grafana/pkg/setting"
)

func TestRingCacheStorage(t *testing.T) {
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

	client := createTestClient(t, cfg, nil)
	runTestsForClient(t, client)
}
