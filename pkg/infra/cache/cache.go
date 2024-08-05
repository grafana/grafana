package cache

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/grafana/dskit/dns"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/kv/codec"
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

func ProvideService(cfg *setting.Cfg) (*Cache, error) {
	memberlistConfig := memberlist.KVConfig{}
	memberlistConfig.Codecs = []codec.Codec{ring.GetCodec()}
	memberlistConfig.TCPTransport = memberlist.TCPTransportConfig{
		BindPort:  ringPort,
		BindAddrs: []string{cfg.HTTPAddr},
	}
	memberlistConfig.JoinMembers = cfg.Cache.JoinMembers

	fmt.Printf("Join Members: %s\n", strings.Join(cfg.Cache.JoinMembers, ","))

	logger := log.With(log.NewLogfmtLogger(os.Stdout), level.AllowDebug())
	resolver := dns.NewProvider(log.With(logger, "component", "dns"), prometheus.NewPedanticRegistry(), dns.GolangResolverType)

	memberlistConfig.NodeName = cfg.HTTPAddr
	memberlistConfig.StreamTimeout = 5 * time.Second

	memberlistsvc := memberlist.NewKVInitService(
		&memberlistConfig,
		log.With(logger, "component", "memberlist"),
		resolver,
		prometheus.NewPedanticRegistry(),
	)

	ctx := context.Background()
	if err := services.StartAndAwaitRunning(ctx, memberlistsvc); err != nil {
		return nil, fmt.Errorf("failed to start kv service: %w", err)
	}

	store, err := memberlistsvc.GetMemberlistKV()
	if err != nil {
		return nil, fmt.Errorf("failed to create kv: %w", err)
	}

	client, err := memberlist.NewClient(store, ring.GetCodec())
	if err != nil {
		return nil, fmt.Errorf("failed to create kv client: %w", err)
	}

	ring, err := newRing(logger, client)
	if err != nil {
		return nil, fmt.Errorf("failed to create ring: %w", err)
	}

	if err := services.StartAndAwaitRunning(ctx, ring); err != nil {
		return nil, fmt.Errorf("failed to start ring: %w", err)
	}

	lfc, err := newRingLifecycler(cfg, logger, client)
	if err != nil {
		return nil, fmt.Errorf("failed to create lfc: %w", err)
	}

	if err := services.StartAndAwaitRunning(ctx, lfc); err != nil {
		return nil, fmt.Errorf("failed to start lfc: %w", err)
	}

	listener, err := net.Listen("tcp", net.JoinHostPort(cfg.HTTPAddr, httpPort))
	if err != nil {
		return nil, err
	}

	c := &Cache{
		id:     cfg.HTTPAddr,
		kv:     client,
		ring:   ring,
		store:  gocache.New(5*time.Minute, 10*time.Minute),
		logger: glog.New("cache"),
	}

	mux := http.NewServeMux()
	mux.Handle("/ring", lfc)
	mux.Handle("/kv", memberlistsvc)

	mux.HandleFunc("GET /cache/{key}", func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")
		c.logger.Info("get cached item", "key", key)
		value, err := c.Get(r.Context(), key)
		if err != nil {
			if errors.Is(err, remotecache.ErrCacheItemNotFound) {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			c.logger.Error("failed to get item", "err", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Header().Add("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(&getResponse{Value: value})
	})

	mux.HandleFunc("POST /cache/internal", func(w http.ResponseWriter, r *http.Request) {
		c.logger.Info("set new item internal")
		var req setRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			c.logger.Error("failed to parse request internal", "err", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		if err := c.Set(r.Context(), req.Key, req.Value, req.Expr); err != nil {
			c.logger.Error("failed to set item internal", "err", err)
			w.WriteHeader(http.StatusBadRequest)
			return

		}
		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("POST /cache", func(w http.ResponseWriter, r *http.Request) {
		c.logger.Info("set new item")
		type request struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		}
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			c.logger.Error("failed to parse request", "err", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		if err := c.Set(r.Context(), req.Key, []byte(req.Value), 1*time.Hour); err != nil {
			c.logger.Error("failed to set item", "err", err)
			w.WriteHeader(http.StatusBadRequest)
			return

		}
		w.WriteHeader(http.StatusOK)
	})

	go func() {
		panic(http.Serve(listener, mux))
	}()

	return c, nil
}

func newRingLifecycler(cfg *setting.Cfg, logger log.Logger, client kv.Client) (*ring.BasicLifecycler, error) {
	var config ring.BasicLifecyclerConfig
	config.ID = cfg.HTTPAddr
	config.Addr = net.JoinHostPort(cfg.HTTPAddr, strconv.Itoa(ringPort))

	var delegate ring.BasicLifecyclerDelegate

	delegate = ring.NewInstanceRegisterDelegate(ring.ACTIVE, 128)
	delegate = ring.NewLeaveOnStoppingDelegate(delegate, logger)
	delegate = ring.NewAutoForgetDelegate(1*time.Minute, delegate, logger)

	return ring.NewBasicLifecycler(
		config,
		"local",
		"collectors/ring",
		client,
		delegate,
		log.With(logger, "component", "lifecycler"),
		prometheus.NewPedanticRegistry(),
	)
}

func newRing(logger log.Logger, client kv.Client) (*ring.Ring, error) {
	var ringConfig ring.Config
	ringConfig.ReplicationFactor = 1
	return ring.NewWithStoreClientAndStrategy(
		ringConfig,
		"local",           // ring name
		"collectors/ring", // prefix key where peers are stored
		client,
		ring.NewDefaultReplicationStrategy(),
		prometheus.NewPedanticRegistry(),
		log.With(logger, "component", "ring"),
	)
}

type Cache struct {
	id     string
	ring   *ring.Ring
	kv     kv.Client
	store  *gocache.Cache
	logger glog.Logger
}

func (c *Cache) Run(ctx context.Context) error {
	fmt.Println("RUNNING cache service")
	return nil
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
