package cachekvstore

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/kvstore"
)

// SingleKeyStore is a Store wrapper with fixed key.
// It's like a Store, but Get and Set do not accept a key, as it's fixed.
type SingleKeyStore interface {
	LastUpdatedStore
	Get(ctx context.Context) (string, bool, error)
	Set(ctx context.Context, value any) error
}

// SingleKeyDeleter is like a Deleter, but Delete does not accept a key, as it's fixed.
type SingleKeyDeleter interface {
	Delete(ctx context.Context) error
}

// StaticStoreKeyGetter returns a StoreKeyGetterFunc that always returns the same key.
// This allows to create stores that only store a single value.
func StaticStoreKeyGetter(staticKey string) StoreKeyGetterFunc {
	return func(string) string {
		return staticKey
	}
}

// SingleKeyNamespacedStore is a NamespacedStore wrapper with fixed key.
// It only allows store a single value (one key) along with its latest update time.
type SingleKeyNamespacedStore struct {
	*NamespacedStore
}

// NewSingleKeyNamespacedStore creates a new SingleKeyNamespacedStore.
func NewSingleKeyNamespacedStore(kv kvstore.KVStore, namespace string, key string, opts ...NamespacedStoreOpt) *SingleKeyNamespacedStore {
	return &SingleKeyNamespacedStore{
		NamespacedStore: NewNamespacedStore(
			kv, namespace,
			WithStoreKeyGetter(StaticStoreKeyGetter(key)),
		),
	}
}

// Get returns the stored value.
func (s *SingleKeyNamespacedStore) Get(ctx context.Context) (string, bool, error) {
	return s.NamespacedStore.Get(ctx, "")
}

// Set stores the value.
func (s *SingleKeyNamespacedStore) Set(ctx context.Context, value any) error {
	return s.NamespacedStore.Set(ctx, "", value)
}

// Delete deletes the stored value.
func (s *SingleKeyNamespacedStore) Delete(ctx context.Context) error {
	return s.NamespacedStore.Delete(ctx, "")
}
