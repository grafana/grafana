package remotecache

import (
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests"
)

func TestIntegrationMemcachedCacheStorage(t *testing.T) {
	tests.SkipIntegrationTestInShortMode(t)

	u, ok := os.LookupEnv("MEMCACHED_HOSTS")
	if !ok || u == "" {
		t.Skip("No Memcached hosts provided")
	}

	opts := &setting.RemoteCacheSettings{Name: memcachedCacheType, ConnStr: u}
	client := createTestClient(t, opts, nil)
	runTestsForClient(t, client)
}
