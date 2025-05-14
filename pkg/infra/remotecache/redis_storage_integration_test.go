package remotecache

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/go-redis/redis/v8"
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

	addr := u
	db := 0
	parsed, err := redis.ParseURL(u)
	if err == nil {
		addr = parsed.Addr
		db = parsed.DB
	}

	b := strings.Builder{}
	b.WriteString(fmt.Sprintf("addr=%s", addr))
	if db != 0 {
		b.WriteString(fmt.Sprintf(",db=%d", db))
	}

	opts := &setting.RemoteCacheSettings{Name: redisCacheType, ConnStr: b.String()}
	client := createTestClient(t, opts, nil)
	runTestsForClient(t, client)
}
