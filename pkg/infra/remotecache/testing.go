package remotecache

import (
	"context"
	"testing"
	"time"

	gocache "github.com/patrickmn/go-cache"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/setting"
)

// NewTestCache keeps cache-dependent tests independent of SQL.
func NewTestCache() *RemoteCache {
	// Get checks expiration, so tests need no cleanup goroutine.
	return &RemoteCache{client: &testCacheStorage{cache: gocache.New(defaultMaxCacheExpiration, 0)}}
}

type testCacheStorage struct {
	cache *gocache.Cache
}

func (s *testCacheStorage) Get(_ context.Context, key string) ([]byte, error) {
	value, ok := s.cache.Get(key)
	if !ok {
		return nil, ErrCacheItemNotFound
	}
	return value.([]byte), nil
}

func (s *testCacheStorage) Set(_ context.Context, key string, value []byte, expire time.Duration) error {
	s.cache.Set(key, value, expire)
	return nil
}

func (s *testCacheStorage) Delete(_ context.Context, key string) error {
	s.cache.Delete(key)
	return nil
}

// NewFakeStore creates store for testing
func NewFakeStore(t *testing.T) *RemoteCache {
	t.Helper()

	opts := &setting.RemoteCacheSettings{
		Name:    "database",
		ConnStr: "",
	}

	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	dc, err := ProvideService(&setting.Cfg{
		RemoteCacheOptions: opts,
	}, sqlStore, &usagestats.UsageStatsMock{}, fakes.NewFakeSecretsService())
	require.NoError(t, err, "Failed to init remote cache for test")

	return dc
}
