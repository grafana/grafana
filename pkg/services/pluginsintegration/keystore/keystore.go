package keystore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins"
)

// Service is a service for storing and retrieving public keys.
type Service struct {
	kv *kvstore.NamespacedKVStore
}

const (
	prefix         = "key-"
	lastUpdatedKey = "last_updated"
)

var _ plugins.KeyStore = (*Service)(nil)

func ProvideService(kv kvstore.KVStore) *Service {
	return &Service{
		kv: kvstore.WithNamespace(kv, 0, "plugin.publickeys"),
	}
}

func (s *Service) Get(ctx context.Context, key string) (string, bool, error) {
	return s.kv.Get(ctx, prefix+key)
}

func (s *Service) Set(ctx context.Context, key string, value string) error {
	return s.kv.Set(ctx, prefix+key, value)
}

func (s *Service) Del(ctx context.Context, key string) error {
	return s.kv.Del(ctx, prefix+key)
}

func (s *Service) GetLastUpdated(ctx context.Context) (*time.Time, error) {
	lastUpdated := &time.Time{}
	if val, ok, err := s.kv.Get(ctx, lastUpdatedKey); err != nil {
		return nil, fmt.Errorf("failed to get last updated time: %v", err)
	} else if ok {
		if parsed, err := time.Parse(time.RFC3339, val); err != nil {
			return nil, fmt.Errorf("failed to parse last updated time: %v", err)
		} else {
			lastUpdated = &parsed
		}
	}
	return lastUpdated, nil
}

func (s *Service) SetLastUpdated(ctx context.Context) error {
	lastUpdated := time.Now()
	if err := s.kv.Set(ctx, lastUpdatedKey, lastUpdated.Format(time.RFC3339)); err != nil {
		return fmt.Errorf("failed to update last updated time: %v", err)
	}
	return nil
}

func (s *Service) ListKeys(ctx context.Context) ([]string, error) {
	keys, err := s.kv.Keys(ctx, prefix)
	if err != nil {
		return nil, err
	}
	res := make([]string, 0, len(keys))
	for _, key := range keys {
		res = append(res, key.Key)
	}
	return res, nil
}
