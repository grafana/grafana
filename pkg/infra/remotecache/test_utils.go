package remotecache

import (
	"context"
	"time"
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

func NewFakeCacheStorage() CacheStorage {
	return FakeCacheStorage{
		Storage: map[string][]byte{},
	}
}
