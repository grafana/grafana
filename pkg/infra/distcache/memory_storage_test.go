package distcache

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
)

func TestMemoryCacheStorage(t *testing.T) {
	opts := &setting.CacheOpts{Name: "memory"}
	runTestsForClient(t, createTestClient(t, opts, nil))
}
