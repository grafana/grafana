// +build redis

package remotecache

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
)

func TestRedisCacheStorage(t *testing.T) {

	opts := &setting.RemoteCacheOptions{Name: redisCacheType, ConnStr: "addr=localhost:6379"}
	client := createTestClient(t, opts, nil)
	runTestsForClient(t, client)
}
