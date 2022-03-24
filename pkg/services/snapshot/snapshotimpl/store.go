package snapshotimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/snapshot"
)

type Store interface {
	Create(ctx context.Context, snapshot *snapshot.Snapshot) error
	Read(ctx context.Context, key string) (*snapshot.Snapshot, error)
	Delete(ctx context.Context, deleteKey string) error

	LookupByDeleteKey(ctx context.Context, deleteKey string) (string, error)
}
