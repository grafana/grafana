package store

import (
	"context"

	"k8s.io/apimachinery/pkg/types"
)

type UniqueObject interface {
	GetIdentifier() types.UID
}

type Store interface {
	Get(ctx context.Context, uid string) (UniqueObject, error)
	//Upsert(context.Context, string, DataSource) error
	Insert(ctx context.Context, o UniqueObject) error
	Update(ctx context.Context, o UniqueObject) error
	Delete(ctx context.Context, uid string) error
}