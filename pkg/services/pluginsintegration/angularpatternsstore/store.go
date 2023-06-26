package angularpatternsstore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
)

var ErrNoCachedValue = errors.New("no cached value")

const (
	kvNamespace = "plugin.angularpatterns"

	keyPatterns    = "angular_patterns"
	keyLastUpdated = "last_updated"
)

// Service allows to cache GCOM angular patterns into the database, as a cache.
type Service struct {
	kv *kvstore.NamespacedKVStore
}

func ProvideService(kv kvstore.KVStore) *Service {
	return &Service{
		kv: kvstore.WithNamespace(kv, 0, kvNamespace),
	}
}

// Get returns the raw cached angular detection patterns. The returned value is a JSON-encoded string.
// If no value is present, ErrNoCachedValue is returned.
func (s *Service) Get(ctx context.Context) (string, error) {
	data, ok, err := s.kv.Get(ctx, keyPatterns)
	if err != nil {
		return "", fmt.Errorf("kv get: %w", err)
	}
	if !ok {
		return "", ErrNoCachedValue
	}
	return data, nil
}

// Set sets the cached angular detection patterns and the latest update time to time.Now().
// patterns must implement json.Marshaler.
func (s *Service) Set(ctx context.Context, patterns any) error {
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
func (s *Service) GetLastUpdated(ctx context.Context) (time.Time, error) {
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
