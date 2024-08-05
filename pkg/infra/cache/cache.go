package cache

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/kv/memberlist"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
	gocache "github.com/patrickmn/go-cache"
	"github.com/prometheus/client_golang/prometheus"

	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ringPort = 3010
	httpPort = "3011"
)

func ProvideService(cfg *setting.Cfg, reg prometheus.Registerer) (*Cache, error) {
	// TODO: adatapt to grafana logger?
	logger := glog.New("cache")
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
		store:  gocache.New(5*time.Minute, 10*time.Minute),
		logger: glog.New("cache"),
	}

	if err := registerRoutes(cfg, c); err != nil {
		return nil, err
	}

	return c, nil
}

type Cache struct {
	id     string
	store  *gocache.Cache
	logger glog.Logger

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

func (c *Cache) Set(ctx context.Context, key string, value []byte, expr time.Duration) error {
	inst, err := c.getInstance(key)
	if err != nil {
		return fmt.Errorf("failed to set cache item %w", err)
	}

	if inst.GetId() == c.id {
		return c.setLocal(ctx, key, value, expr)
	}

	return c.setDelegated(ctx, key, value, expr, inst)
}

func (c *Cache) setLocal(_ context.Context, key string, value []byte, expr time.Duration) error {
	c.store.Set(key, value, expr)
	return nil
}

type setRequest struct {
	Key   string        `json:"key"`
	Value []byte        `json:"value"`
	Expr  time.Duration `json:"expr"`
}

func (c *Cache) setDelegated(ctx context.Context, key string, value []byte, expr time.Duration, inst *ring.InstanceDesc) error {
	buf := &bytes.Buffer{}
	if err := json.NewEncoder(buf).Encode(&setRequest{key, value, expr}); err != nil {
		return fmt.Errorf("failed to delegate set cache: %w", err)
	}

	// Hack: we store http addr in id so we can use that and the hardcoded port for now
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, getInstanceURL(inst)+"/cache/internal", buf)
	if err != nil {
		return fmt.Errorf("failed to delegate set cache: %w", err)
	}

	req.Header.Add("Content-Type", "applicaton/json")
	req.Header.Add("User-Agent", "inst/"+c.id)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delegate set cache: %w", err)
	}

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to delegate set cache: %s", res.Status)
	}

	return nil
}

func (c *Cache) Get(ctx context.Context, key string) ([]byte, error) {
	inst, err := c.getInstance(key)
	if err != nil {
		return nil, err
	}

	if inst.GetId() == c.id {
		return c.getLocal(ctx, key)
	}

	return c.getDelegated(ctx, key, inst)
}

func (c *Cache) getLocal(_ context.Context, key string) ([]byte, error) {
	data, ok := c.store.Get(key)
	if !ok {
		return nil, remotecache.ErrCacheItemNotFound
	}

	return data.([]byte), nil
}

type getResponse struct {
	Value []byte `json:"value"`
}

func (c *Cache) getDelegated(ctx context.Context, key string, inst *ring.InstanceDesc) ([]byte, error) {
	// TODO: url encode key
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, getInstanceURL(inst)+"/cache/"+key, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to delegate get cache: %w", err)
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to delegate get cache: %w", err)
	}

	if res.StatusCode != http.StatusOK {
		if res.StatusCode == http.StatusNotFound {
			return nil, remotecache.ErrCacheItemNotFound
		}
		return nil, fmt.Errorf("failed to delegate get cache: %s", res.Status)
	}

	var body getResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, err
	}
	return body.Value, nil
}

func (c *Cache) getInstance(key string) (*ring.InstanceDesc, error) {
	hasher := fnv.New32()
	_, _ = hasher.Write([]byte(key))
	set, err := c.ring.Get(hasher.Sum32(), ring.Read, nil, nil, nil)
	if err != nil {
		return nil, err
	}

	// assume always one instance in a set
	if len(set.Instances) != 1 {
		return nil, ring.ErrInstanceNotFound
	}
	return &set.Instances[0], nil
}

func getInstanceURL(inst *ring.InstanceDesc) string {
	return "http://" + net.JoinHostPort(inst.GetId(), httpPort)
}
