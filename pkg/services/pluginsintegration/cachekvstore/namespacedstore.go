package cachekvstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
)

const defaultLastUpdatedKey = "last_updated"

// NamespacedStore is a Store that stores data in a *kvstore.NamespacedKVStore.
// It uses the provided StoreKeyGetter to get the key to use for a given key.
// It also stores a last updated time, which is unique for all the keys and is updated on
// each call to `Set` and can be used to determine if the data is stale.
type NamespacedStore struct {
	// kv is the underlying KV store.
	kv *kvstore.NamespacedKVStore

	// storeKeyGetter is a function that returns the key to use for a given key.
	// This allows the key for the underlying storage to be modified.
	// This is only used for actual data, not for the last updated time key.
	storeKeyGetter StoreKeyGetter

	// lastUpdatedKey is the key to use for the last updated time key.
	lastUpdatedKey string
}

// DefaultStoreKeyGetterFunc is the default StoreKeyGetterFunc, which returns the key as-is.
// This allows to create stores that store multiple values.
var DefaultStoreKeyGetterFunc = StoreKeyGetterFunc(func(k string) string {
	return k
})

// StaticStoreKeyGetter returns a StoreKeyGetterFunc that always returns the same key.
// This allows to create stores that only store a single value.
func StaticStoreKeyGetter(staticKey string) StoreKeyGetterFunc {
	return func(string) string {
		return staticKey
	}
}

// PrefixStoreKeyGetter returns a StoreKeyGetterFunc that returns the key with a prefix.
func PrefixStoreKeyGetter(prefix string) StoreKeyGetterFunc {
	return func(k string) string {
		return prefix + k
	}
}

// NamespacedStoreOpt is an option for NewNamespacedStore.
// It modifies the provided store.
type NamespacedStoreOpt func(store *NamespacedStore)

// WithLastUpdatedKey sets the key to use for the last updated time key.
func WithLastUpdatedKey(lastUpdatedKey string) NamespacedStoreOpt {
	return func(store *NamespacedStore) {
		store.lastUpdatedKey = lastUpdatedKey
	}
}

// WithStoreKeyGetter sets the StoreKeyGetter to use.
func WithStoreKeyGetter(g StoreKeyGetter) NamespacedStoreOpt {
	return func(store *NamespacedStore) {
		store.storeKeyGetter = g
	}
}

// NewNamespacedStore creates a new NamespacedStore using the provided underlying KVStore and namespace.
func NewNamespacedStore(kv kvstore.KVStore, namespace string, opts ...NamespacedStoreOpt) *NamespacedStore {
	store := &NamespacedStore{
		kv: kvstore.WithNamespace(kv, 0, namespace),
	}
	for _, opt := range opts {
		opt(store)
	}
	// Default values if the options did not modify them.
	if store.storeKeyGetter == nil {
		store.storeKeyGetter = DefaultStoreKeyGetterFunc
	}
	if store.lastUpdatedKey == "" {
		store.lastUpdatedKey = defaultLastUpdatedKey
	}
	return store
}

// Get returns the value for the given key.
// If no value is present, the second argument is false and the returned error is nil.
func (s *NamespacedStore) Get(ctx context.Context, key string) (string, bool, error) {
	return s.kv.Get(ctx, s.storeKeyGetter.GetStoreKey(key))
}

// Set sets the value for the given key and updates the last updated time.
// The value must be a Marshaler, a fmt.Stringer, a string or []byte.
func (s *NamespacedStore) Set(ctx context.Context, key string, value any) error {
	// TODO: move
	var valueToStore string
	if valueMarshaler, ok := value.(Marshaler); ok {
		var err error
		valueToStore, err = valueMarshaler.Marshal()
		if err != nil {
			return fmt.Errorf("marshal: %w", err)
		}
	} else if valueStringer, ok := value.(fmt.Stringer); ok {
		valueToStore = valueStringer.String()
	} else if valueString, ok := value.(string); ok {
		valueToStore = valueString
	} else if valueBytes, ok := value.([]byte); ok {
		valueToStore = string(valueBytes)
	} else {
		return fmt.Errorf("unsupported value type: %T", value)
	}

	if err := s.kv.Set(ctx, key, valueToStore); err != nil {
		return fmt.Errorf("kv set: %w", err)
	}
	if err := s.SetLastUpdated(ctx); err != nil {
		return fmt.Errorf("set last updated: %w", err)
	}
	return nil
}

// GetLastUpdated returns the last updated time.
// If the last updated time is not set, it returns a zero time.
func (s *NamespacedStore) GetLastUpdated(ctx context.Context) (time.Time, error) {
	v, ok, err := s.kv.Get(ctx, s.lastUpdatedKey)
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
func (s *NamespacedStore) SetLastUpdated(ctx context.Context) error {
	return s.kv.Set(ctx, s.lastUpdatedKey, time.Now().Format(time.RFC3339))
}

// Delete deletes the value for the given key.
func (s *NamespacedStore) Delete(ctx context.Context, key string) error {
	return s.kv.Del(ctx, s.storeKeyGetter.GetStoreKey(key))
}

// ListKeys returns all the keys in the store.
func (s *NamespacedStore) ListKeys(ctx context.Context) ([]string, error) {
	keys, err := s.kv.Keys(ctx, s.storeKeyGetter.GetStoreKey(""))
	if err != nil {
		return nil, err
	}
	res := make([]string, 0, len(keys))
	for _, key := range keys {
		res = append(res, key.Key)
	}
	return res, nil
}
