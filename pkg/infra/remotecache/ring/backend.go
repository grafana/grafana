package ring

import (
	"context"
	"fmt"
	"time"

	gocache "github.com/patrickmn/go-cache"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	"github.com/grafana/dskit/ring"
	"github.com/grafana/grafana/pkg/infra/remotecache/common"
)

type Backend interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, expire time.Duration) error
	Delete(ctx context.Context, key string) error
}

func newLocalBackend() *localBackend {
	return &localBackend{
		store: gocache.New(5*time.Minute, 10*time.Minute),
	}
}

type localBackend struct {
	store *gocache.Cache
}

func (b *localBackend) Get(ctx context.Context, key string) ([]byte, error) {
	data, ok := b.store.Get(key)
	if !ok {
		return nil, common.ErrCacheItemNotFound
	}

	return data.([]byte), nil
}

func (b *localBackend) Set(ctx context.Context, key string, value []byte, expire time.Duration) error {
	b.store.Set(key, value, expire)
	return nil

}

func (b *localBackend) Delete(ctx context.Context, key string) error {
	b.store.Delete(key)
	return nil
}

func newRemoteBackend(inst *ring.InstanceDesc) (*dispatchBackend, error) {
	cc, err := grpc.NewClient(inst.GetId(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &dispatchBackend{
		NewDispatcherClient(cc),
	}, nil
}

type dispatchBackend struct {
	client DispatcherClient
}

func (b *dispatchBackend) Get(ctx context.Context, key string) ([]byte, error) {
	res, err := b.client.DispatchGet(ctx, &GetRequest{Key: key})
	if err != nil {
		st, ok := status.FromError(err)
		if ok && st.Code() == codes.NotFound {
			return nil, common.ErrCacheItemNotFound
		}

		return nil, fmt.Errorf("failed to dipatch get request: %w", err)
	}
	return res.Value, nil
}

func (b *dispatchBackend) Set(ctx context.Context, key string, value []byte, expr time.Duration) error {
	_, err := b.client.DispatchSet(ctx, &SetRequest{Key: key, Value: value, Expr: int64(expr)})
	if err != nil {
		return fmt.Errorf("failed to dipatch set request: %w", err)
	}
	return nil
}

func (b *dispatchBackend) Delete(ctx context.Context, key string) error {
	_, err := b.client.DispatchDelete(ctx, &DeleteRequest{Key: key})
	if err != nil {
		return fmt.Errorf("failed to dipatch delete request: %w", err)
	}
	return nil
}
