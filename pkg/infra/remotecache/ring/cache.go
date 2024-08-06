package ring

import (
	"context"
	"fmt"
	"hash/fnv"
	"strconv"
	"time"

	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/kv/memberlist"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
)

const CacheType = "ring"
const httpPort = "3011"

func NewCache(cfg *setting.Cfg, reg prometheus.Registerer, provider grpcserver.Provider) (*Cache, error) {
	fmt.Println("Init ring cache")
	logger := log.New("remotecache.ring")

	memberlistsvc, client, err := newMemberlistService(memberlistConfig{
		Addr:        cfg.HTTPAddr,
		Port:        cfg.RemoteCache.Ring.Port,
		JoinMembers: cfg.RemoteCache.Ring.JoinMembers,
	}, logger, reg)

	ring, lfc, err := newRing(
		ringConfig{Addr: cfg.HTTPAddr, Port: strconv.Itoa(cfg.RemoteCache.Ring.Port)},
		logger,
		client,
		reg,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create ring: %w", err)
	}

	c := &Cache{
		lfc:      lfc,
		kv:       client,
		ring:     ring,
		mlist:    memberlistsvc,
		logger:   logger,
		provider: provider,
		local:    newLocalBackend(),
	}

	RegisterDispatcherServer(c.provider.GetServer(), c)

	if err := registerRoutes(cfg, c); err != nil {
		return nil, err
	}

	return c, nil
}

type Cache struct {
	UnimplementedDispatcherServer
	id       string
	logger   glog.Logger
	provider grpcserver.Provider

	local *localBackend

	kv    kv.Client
	lfc   *ring.BasicLifecycler
	ring  *ring.Ring
	mlist *memberlist.KVInitService
}

func (c *Cache) Run(ctx context.Context) error {
	// TODO: Fix addr for nodes
	c.id = c.provider.GetAddress()

	if err := services.StartAndAwaitRunning(ctx, c.mlist); err != nil {
		return fmt.Errorf("failed to start kv service: %w", err)
	}

	stopCtx := context.Background()
	defer services.StopAndAwaitTerminated(stopCtx, c.mlist)

	if err := services.StartAndAwaitRunning(ctx, c.ring); err != nil {
		return fmt.Errorf("failed to start ring: %w", err)
	}

	defer services.StopAndAwaitTerminated(stopCtx, c.ring)

	if err := services.StartAndAwaitRunning(ctx, c.lfc); err != nil {
		return fmt.Errorf("failed to start lfc: %w", err)
	}

	defer services.StopAndAwaitTerminated(stopCtx, c.lfc)

	<-ctx.Done()
	return ctx.Err()
}

func (c *Cache) Get(ctx context.Context, key string) ([]byte, error) {
	backend, err := c.getBackend(key, ring.Read)
	if err != nil {
		return nil, err
	}

	return backend.Get(ctx, key)
}

func (c *Cache) Set(ctx context.Context, key string, value []byte, expr time.Duration) error {
	backend, err := c.getBackend(key, ring.Write)
	if err != nil {
		return err
	}

	return backend.Set(ctx, key, value, expr)
}

func (c *Cache) Delete(ctx context.Context, key string) error {
	backend, err := c.getBackend(key, ring.Write)
	if err != nil {
		return err
	}

	return backend.Delete(ctx, key)
}

// not implemented
func (c *Cache) Count(_ context.Context, _ string) (int64, error) {
	return 0, nil
}

func (c *Cache) DispatchGet(ctx context.Context, r *GetRequest) (*GetResponse, error) {
	value, err := c.Get(ctx, r.Key)
	if err != nil {
		return nil, err
	}
	return &GetResponse{Value: value}, nil
}

func (c *Cache) DispatchSet(ctx context.Context, r *SetRequest) (*SetResponse, error) {
	if err := c.Set(ctx, r.Key, r.Value, time.Duration(r.Expr)); err != nil {
		return nil, err
	}
	return &SetResponse{}, nil
}

func (c *Cache) DispatchDelete(ctx context.Context, r *DeleteRequest) (*DeleteResponse, error) {
	if err := c.Delete(ctx, r.Key); err != nil {
		return nil, err
	}
	return &DeleteResponse{}, nil
}

func (c *Cache) getBackend(key string, op ring.Operation) (Backend, error) {
	hasher := fnv.New32()
	_, _ = hasher.Write([]byte(key))
	set, err := c.ring.Get(hasher.Sum32(), op, nil, nil, nil)
	if err != nil {
		return nil, err
	}

	// assume always one instance in a set
	if len(set.Instances) != 1 {
		return nil, ring.ErrInstanceNotFound
	}

	inst := set.Instances[0]
	if inst.GetId() == c.id {
		return c.local, nil
	}

	// TODO: cache remote clients?
	return newRemoteBackend(&inst)
}
