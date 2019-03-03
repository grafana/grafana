// +build memcached

package distcache

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
)

func TestMemcachedCacheStorage(t *testing.T) {
	opts := &setting.CacheOpts{Name: "memcache", ConnStr: "localhost:11211"}
	runTestsForClient(t, createTestClient(t, opts, nil))
}
