package persistentcollection

import (
	"context"
)

type Predicate[T any] func(item T) (bool, error)
type UpdateFn[T any] func(item T) (updated bool, updatedItem T, err error)

// PersistentCollection is a collection of items that's going to retain its state between Grafana restarts.
// The main purpose of this API is to reduce the time-to-Proof-of-Concept - this is NOT intended for production use.
//
// The item type needs to be serializable to JSON.
type PersistentCollection[T any] interface {
	Delete(ctx context.Context, orgID int64, predicate Predicate[T]) (deletedCount int, err error)
	FindFirst(ctx context.Context, orgID int64, predicate Predicate[T]) (T, error)
	Find(ctx context.Context, orgID int64, predicate Predicate[T]) ([]T, error)
	Update(ctx context.Context, orgID int64, updateFn UpdateFn[T]) (updatedCount int, err error)
	Insert(ctx context.Context, orgID int64, item T) error
}
