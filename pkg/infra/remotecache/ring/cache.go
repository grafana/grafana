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
	"github.com/grafana/grafana/pkg/setting"
)

const CacheType = "ring"

var (
	ringPort = 3010
	httpPort = "3011"
)

func NewCache(cfg *setting.Cfg, reg prometheus.Registerer) (*Cache, error) {
	logger := log.New("cache")
	memberlistsvc, client, err := newMemberlistService(memberlistConfig{
		Addr:        cfg.HTTPAddr,
		Port:        ringPort,
		JoinMembers: cfg.Cache.JoinMembers,
	}, logger, reg)

	ring, lfc, err := newRing(
		ringConfig{Addr: cfg.HTTPAddr, Port: strconv.Itoa(ringPort)},
		logger,
		client,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create ring: %w", err)
	}

	c := &Cache{
		id:     cfg.HTTPAddr,
		lfc:    lfc,
		kv:     client,
		ring:   ring,
		mlist:  memberlistsvc,
		logger: glog.New("cache"),

		local: newLocalBackend(),
	}

	if err := registerRoutes(cfg, c); err != nil {
		return nil, err
	}

	return c, nil
}

type Cache struct {
	id     string
	logger glog.Logger

	local *localBackend

	kv    kv.Client
	lfc   *ring.BasicLifecycler
	ring  *ring.Ring
	mlist *memberlist.KVInitService
}

func (c *Cache) Run(ctx context.Context) error {
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
	return newRemoteBackend(&inst), nil
}
