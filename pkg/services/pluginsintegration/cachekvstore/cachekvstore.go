package cachekvstore

import (
	"context"
	"time"
)

// LastUpdateGetter can get the last time the store was updated.
// The last updated time is shared between all keys in the store.
type LastUpdateGetter interface {
	// GetLastUpdated returns the last time the store was updated.
	GetLastUpdated(ctx context.Context) (time.Time, error)
}

// LastUpdatedStore can get and set the time when the store was updated.
// The last updated time is shared between all keys in the store.
type LastUpdatedStore interface {
	LastUpdateGetter

	// SetLastUpdated sets the last time the store was updated.
	SetLastUpdated(ctx context.Context) error
}

// Store is a key-value store that also keeps track of the last update time of the whole store.
// The last updated time can be used to determine if the stored data is stale.
type Store interface {
	LastUpdatedStore

	// Get returns the stored value for the given key.
	// If the value does not exist, it returns false and a nil error.
	Get(ctx context.Context, key string) (string, bool, error)

	// Set stores the value for the given key.
	Set(ctx context.Context, key string, value any) error
}

// Deleter can delete a key from the store.
type Deleter interface {
	// Delete deletes the given key from the store.
	Delete(ctx context.Context, key string) error
}

// KeyLister can list all keys in the store.
type KeyLister interface {
	// ListKeys returns all keys stored in the store.
	ListKeys(ctx context.Context) ([]string, error)
}

// StoreKeyGetter returns the key used to store the value.
// It can be used to dynamically determine transform a key before passing it to the underlying store.
type StoreKeyGetter interface {
	GetStoreKey(k string) string
}

// StoreKeyGetterFunc is a function that implements StoreKeyGetter.
// It can be used for simple key transformations.
type StoreKeyGetterFunc func(k string) string

// GetStoreKey calls the function.
func (f StoreKeyGetterFunc) GetStoreKey(k string) string {
	return f(k)
}
