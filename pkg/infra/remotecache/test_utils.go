package remotecache

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/setting"
)

type FakeCacheStorage struct {
	Storage map[string][]byte
}

func (fcs FakeCacheStorage) Set(_ context.Context, key string, value []byte, exp time.Duration) error {
	fcs.Storage[key] = value
	return nil
}

func (fcs FakeCacheStorage) Get(_ context.Context, key string) ([]byte, error) {
	value, exist := fcs.Storage[key]
	if !exist {
		return nil, ErrCacheItemNotFound
	}

	return value, nil
}

func (fcs FakeCacheStorage) Delete(_ context.Context, key string) error {
	delete(fcs.Storage, key)
	return nil
}

func (fcs FakeCacheStorage) Count(_ context.Context, prefix string) (int64, error) {
	return int64(len(fcs.Storage)), nil
}

func NewFakeCacheStorage() FakeCacheStorage {
	return FakeCacheStorage{
		Storage: map[string][]byte{},
	}
}

func CreateTestClient(t *testing.T, opts *setting.RemoteCacheOptions, sqlstore db.DB) CacheStorage {
	t.Helper()

	cfg := &setting.Cfg{
		RemoteCacheOptions: opts,
	}
	dc, err := ProvideService(cfg, sqlstore, fakes.NewFakeSecretsService())
	require.Nil(t, err, "Failed to init client for test")

	return dc
}

func CreateTestRedisCacheStorage(t *testing.T) *RemoteCache {
	t.Helper()

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

	opts := &setting.RemoteCacheOptions{Name: setting.RedisCacheType,
		ConnStr: b.String(), Prefix: t.Name()}
	client := CreateTestClient(t, opts, nil)
	return &RemoteCache{
		SQLStore: nil,
		Cfg:      setting.NewCfg(),
		client:   client,
	}
}
