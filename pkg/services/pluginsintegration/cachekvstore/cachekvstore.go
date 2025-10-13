package cachekvstore

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
)

// keyLastUpdated is the key used to store the last updated time.
const keyLastUpdated = "last_updated"

// CacheKvStore is a Store that stores data in a *kvstore.NamespacedKVStore.
// It also stores a last updated time, which is unique for all the keys and is updated on each call to `Set`,
// and can be used to determine if the data is stale.
type CacheKvStore struct {
	// kv is the underlying KV store.
	kv *kvstore.NamespacedKVStore

	// keyPrefix is the prefix to use for all the keys.
	keyPrefix string
}

// NewCacheKvStoreWithPrefix creates a new CacheKvStore using the provided underlying KVStore, namespace and prefix.
func NewCacheKvStoreWithPrefix(kv kvstore.KVStore, namespace, prefix string) *CacheKvStore {
	return &CacheKvStore{
		kv:        kvstore.WithNamespace(kv, 0, namespace),
		keyPrefix: prefix,
	}
}

// NewCacheKvStore creates a new CacheKvStore using the provided underlying KVStore and namespace.
func NewCacheKvStore(kv kvstore.KVStore, namespace string) *CacheKvStore {
	return NewCacheKvStoreWithPrefix(kv, namespace, "")
}

// storeKey returns the key to use in the underlying store for the given key.
func (s *CacheKvStore) storeKey(k string) string {
	return s.keyPrefix + k
}

// Get returns the value for the given key.
// If no value is present, the second argument is false and the returned error is nil.
func (s *CacheKvStore) Get(ctx context.Context, key string) (string, bool, error) {
	return s.kv.Get(ctx, s.storeKey(key))
}

// Set sets the value for the given key and updates the last updated time.
// It uses the marshal method to marshal the value before storing it.
// This means that the value to store can implement the Marshaler interface to control how it is stored.
func (s *CacheKvStore) Set(ctx context.Context, key string, value any) error {
	valueToStore, err := marshal(value)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	if err := s.kv.Set(ctx, s.storeKey(key), valueToStore); err != nil {
		return fmt.Errorf("kv set: %w", err)
	}
	if err := s.SetLastUpdated(ctx); err != nil {
		return fmt.Errorf("set last updated: %w", err)
	}
	return nil
}

// GetLastUpdated returns the last updated time.
// If the last updated time is not set, it returns a zero time.
func (s *CacheKvStore) GetLastUpdated(ctx context.Context) (time.Time, error) {
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

// SetLastUpdated sets the last updated time to the current time.
// The last updated time is shared between all the keys for this store.
func (s *CacheKvStore) SetLastUpdated(ctx context.Context) error {
	return s.kv.Set(ctx, keyLastUpdated, time.Now().Format(time.RFC3339))
}

// Delete deletes the value for the given key and it also updates the last updated time.
func (s *CacheKvStore) Delete(ctx context.Context, key string) error {
	if err := s.kv.Del(ctx, s.storeKey(key)); err != nil {
		return fmt.Errorf("kv del: %w", err)
	}
	if err := s.SetLastUpdated(ctx); err != nil {
		return fmt.Errorf("set last updated: %w", err)
	}
	return nil
}

// ListKeys returns all the keys in the store.
func (s *CacheKvStore) ListKeys(ctx context.Context) ([]string, error) {
	keys, err := s.kv.Keys(ctx, s.storeKey(""))
	if err != nil {
		return nil, err
	}
	if len(keys) == 0 {
		return nil, nil
	}
	res := make([]string, 0, len(keys)-1)
	for _, key := range keys {
		// Filter out last updated time
		if key.Key == keyLastUpdated {
			continue
		}
		res = append(res, key.Key)
	}
	return res, nil
}

// marshal marshals the provided value to a string to store it in the kv store.
// The provided value can be of a type implementing fmt.Stringer, a string or []byte.
// If the value is none of those, it is marshaled to JSON.
func marshal(value any) (string, error) {
	switch value := value.(type) {
	case fmt.Stringer:
		return value.String(), nil
	case string:
		return value, nil
	case []byte:
		return string(value), nil
	default:
		b, err := json.Marshal(value)
		if err != nil {
			return "", fmt.Errorf("json marshal: %w", err)
		}
		return string(b), nil
	}
}
