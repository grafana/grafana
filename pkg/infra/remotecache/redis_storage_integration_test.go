package remotecache

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationRedisCacheStorage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	u, ok := os.LookupEnv("REDIS_URL")
	if !ok || u == "" {
		t.Skip("No redis URL supplied")
	}

	trimmed := strings.TrimLeft(u, "redis://")

	opts := &setting.RemoteCacheOptions{Name: redisCacheType, ConnStr: fmt.Sprintf("addr=%s", trimmed)}
	client := createTestClient(t, opts, nil)
	runTestsForClient(t, client)
	runCountTestsForClient(t, opts, nil)
}
