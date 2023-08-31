package angularpatternsstore

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
)

type Service interface {
	Get(ctx context.Context) (string, bool, error)
	Set(ctx context.Context, patterns any) error
	GetLastUpdated(ctx context.Context) (time.Time, error)
}

const (
	kvNamespace = "plugin.angularpatterns"

	keyPatterns    = "angular_patterns"
	keyLastUpdated = "last_updated"
)

// KVStoreService allows to cache GCOM angular patterns into the database, as a cache.
type KVStoreService struct {
	kv *kvstore.NamespacedKVStore
}

func ProvideService(kv kvstore.KVStore) Service {
	return &KVStoreService{
		kv: kvstore.WithNamespace(kv, 0, kvNamespace),
	}
}

// Get returns the raw cached angular detection patterns. The returned value is a JSON-encoded string.
// If no value is present, the second argument is false and the returned error is nil.
func (s *KVStoreService) Get(ctx context.Context) (string, bool, error) {
	return s.kv.Get(ctx, keyPatterns)
}

// Set sets the cached angular detection patterns and the latest update time to time.Now().
// patterns must implement json.Marshaler.
func (s *KVStoreService) Set(ctx context.Context, patterns any) error {
	b, err := json.Marshal(patterns)
	if err != nil {
		return fmt.Errorf("json marshal: %w", err)
	}
	if err := s.kv.Set(ctx, keyPatterns, string(b)); err != nil {
		return fmt.Errorf("kv set: %w", err)
	}
	if err := s.kv.Set(ctx, keyLastUpdated, time.Now().Format(time.RFC3339)); err != nil {
		return fmt.Errorf("kv last updated set: %w", err)
	}
	return nil
}

// GetLastUpdated returns the time when Set was last called. If the value cannot be unmarshalled correctly,
// it returns a zero-value time.Time.
func (s *KVStoreService) GetLastUpdated(ctx context.Context) (time.Time, error) {
	v, ok, err := s.kv.Get(ctx, keyLastUpdated)
	if err != nil {
		return time.Time{}, fmt.Errorf("kv get: %w", err)
	}
	if !ok {
		return time.Time{}, nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		// Ignore decode errors, so we can change the format in future versions
		// and keep backwards/forwards compatibility
		return time.Time{}, nil
	}
	return t, nil
}
