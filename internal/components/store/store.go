package store

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
)

type Store interface {
	Get(ctx context.Context, uid string) (runtime.Object, error)
	//Upsert(context.Context, string, DataSource) error
	Insert(ctx context.Context, o runtime.Object) error
	Update(ctx context.Context, o runtime.Object) error
	Delete(ctx context.Context, uid string) error
}