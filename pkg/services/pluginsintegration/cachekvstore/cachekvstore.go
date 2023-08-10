package cachekvstore

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

type LastUpdatedStore interface {
	GetLastUpdated(ctx context.Context) (time.Time, error)
	SetLastUpdated(ctx context.Context) error
}

type Store interface {
	LastUpdatedStore
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key string, value Marshaler) error
}

type Deleter interface {
	Delete(ctx context.Context, key string) error
}

type StoreKeyGetter interface {
	GetStoreKey(k string) string
}

type StoreKeyGetterFunc func(k string) string

func (f StoreKeyGetterFunc) GetStoreKey(k string) string {
	return f(k)
}

type Marshaler interface {
	Marshal() (string, error)
}

type JSONMarshaler struct {
	value any
}

func NewJSONMarshaler(v any) JSONMarshaler {
	return JSONMarshaler{value: v}
}

func (m JSONMarshaler) Marshal() (string, error) {
	b, err := json.Marshal(m.value)
	if err != nil {
		return "", fmt.Errorf("json marshal: %w", err)
	}
	return string(b), nil
}
