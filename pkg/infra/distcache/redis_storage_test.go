package distcache

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
)

func TestRedisCacheStorage(t *testing.T) {

	opts := &setting.CacheOpts{Name: "redis", ConnStr: "localhost:6379"}
	runTestsForClient(t, createTestClient(t, opts, nil))
}
