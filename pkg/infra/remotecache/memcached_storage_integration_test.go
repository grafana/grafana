// +build memcached

package remotecache

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
)

func TestMemcachedCacheStorage(t *testing.T) {
	opts := &setting.RemoteCacheOptions{Name: "memcached", ConnStr: "localhost:11211"}
	runTestsForClient(t, createTestClient(t, opts, nil))
}
