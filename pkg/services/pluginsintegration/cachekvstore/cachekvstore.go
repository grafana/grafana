package cachekvstore

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// LastUpdatedStore keeps track of the last time the store was updated.
type LastUpdatedStore interface {
	// GetLastUpdated returns the last time the store was updated.
	GetLastUpdated(ctx context.Context) (time.Time, error)

	// SetLastUpdated sets the last time the store was updated.
	SetLastUpdated(ctx context.Context) error
}

// Store is a key-value store with a last updated key that keeps track of the last time the store was updated.
// It can be used to determine if the stored data is stale.
type Store interface {
	LastUpdatedStore

	// Get returns the stored value for the given key.
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
	// TODO: does it return the last updated key?
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

// Marshaler can marshal a value to a string before storing it into the key-value store.
type Marshaler interface {
	Marshal() (string, error)
}

// JSONMarshaler is a Marshaler that marshals the value to JSON.
type JSONMarshaler struct {
	value any
}

// NewJSONMarshaler returns a new JSONMarshaler for the provided value.
func NewJSONMarshaler(v any) JSONMarshaler {
	return JSONMarshaler{value: v}
}

// Marshal marshals the value to JSON using json.Marshal, and returns it as a string.
func (m JSONMarshaler) Marshal() (string, error) {
	b, err := json.Marshal(m.value)
	if err != nil {
		return "", fmt.Errorf("json marshal: %w", err)
	}
	return string(b), nil
}
