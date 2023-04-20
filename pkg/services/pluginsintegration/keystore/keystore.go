package keystore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// Service is a service for storing and retrieving public keys.
type Service struct {
	kv   *kvstore.NamespacedKVStore
	slog log.Logger
}

const (
	prefix         = "key-"
	lastUpdatedKey = "last_updated"
)

func ProvideService(kv kvstore.KVStore) *Service {
	return &Service{
		kv:   kvstore.WithNamespace(kv, 0, "plugin.publickeys"),
		slog: log.New("plugin.publickeys"),
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

func (s *Service) GetLastUpdated(ctx context.Context) time.Time {
	lastUpdated := time.Time{}
	if val, ok, err := s.kv.Get(ctx, lastUpdatedKey); err != nil {
		s.slog.Error("Failed to get last sent time", "error", err)
	} else if ok {
		if parsed, err := time.Parse(time.RFC3339, val); err != nil {
			s.slog.Error("Failed to parse last sent time", "error", err)
		} else {
			lastUpdated = parsed
		}
	}
	return lastUpdated
}

func (s *Service) SetLastUpdated(ctx context.Context) {
	lastUpdated := time.Now()
	if err := s.kv.Set(ctx, lastUpdatedKey, lastUpdated.Format(time.RFC3339)); err != nil {
		s.slog.Warn("Failed to update last sent time", "error", err)
	}
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
