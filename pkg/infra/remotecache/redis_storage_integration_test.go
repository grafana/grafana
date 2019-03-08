// +build redis

package remotecache

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
)

func TestRedisCacheStorage(t *testing.T) {

	opts := &setting.RemoteCacheOptions{Name: "redis", ConnStr: "localhost:6379"}
	runTestsForClient(t, createTestClient(t, opts, nil))
}
