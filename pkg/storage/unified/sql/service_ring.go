package sql

import (
	"context"
	"fmt"
	"hash/fnv"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/netutil"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// searchOwnerRead is the operation used by the search-servers to check if they own the namespace.
var searchOwnerRead = ring.NewOp([]ring.InstanceState{ring.JOINING, ring.ACTIVE, ring.LEAVING}, nil)

// RingConfig contains the configuration for initializing the ring lifecycler.
type RingConfig struct {
	Cfg                *setting.Cfg
	Log                log.Logger
	Reg                prometheus.Registerer
	MemberlistKVConfig kv.Config
	SearchRing         *ring.Ring
}

// RingState holds the ring lifecycler and search ring state.
type RingState struct {
	Lifecycler *ring.BasicLifecycler
	SearchRing *ring.Ring
	Log        log.Logger
}

// InitRingLifecycler initializes the ring lifecycler if sharding is enabled.
// Returns nil state if sharding is not enabled.
// The returned lifecycler should be added to the subservices manager.
func InitRingLifecycler(cfg RingConfig) (*RingState, []services.Service, error) {
	if !cfg.Cfg.EnableSharding {
		return nil, nil, nil
	}

	ringStore, err := kv.NewClient(
		cfg.MemberlistKVConfig,
		ring.GetCodec(),
		kv.RegistererWithKVName(cfg.Reg, resource.RingName),
		cfg.Log,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create KV store client: %w", err)
	}

	lifecyclerCfg, err := toLifecyclerConfig(cfg.Cfg, cfg.Log)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to initialize ring lifecycler config: %w", err)
	}

	// Define lifecycler delegates in reverse order (last to be called defined first because they're
	// chained via "next delegate").
	delegate := ring.BasicLifecyclerDelegate(ring.NewInstanceRegisterDelegate(ring.JOINING, resource.RingNumTokens))
	delegate = ring.NewLeaveOnStoppingDelegate(delegate, cfg.Log)
	delegate = ring.NewAutoForgetDelegate(resource.RingHeartbeatTimeout*2, delegate, cfg.Log)

	lifecycler, err := ring.NewBasicLifecycler(
		lifecyclerCfg,
		resource.RingName,
		resource.RingKey,
		ringStore,
		delegate,
		cfg.Log,
		cfg.Reg,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to initialize ring lifecycler: %w", err)
	}

	lifecycler.SetKeepInstanceInTheRingOnShutdown(true)

	state := &RingState{
		Lifecycler: lifecycler,
		SearchRing: cfg.SearchRing,
		Log:        cfg.Log,
	}

	return state, []services.Service{lifecycler}, nil
}

// OwnsIndex checks if this instance owns the index for the given namespace.
// Returns true if no ring is configured (single instance mode) or if this instance
// owns the namespace according to the ring.
func (r *RingState) OwnsIndex(key resource.NamespacedResource) (bool, error) {
	if r == nil || r.SearchRing == nil {
		return true, nil
	}

	if st := r.SearchRing.State(); st != services.Running {
		return false, fmt.Errorf("ring is not Running: %s", st)
	}

	ringHasher := fnv.New32a()
	_, err := ringHasher.Write([]byte(key.Namespace))
	if err != nil {
		return false, fmt.Errorf("error hashing namespace: %w", err)
	}

	rs, err := r.SearchRing.GetWithOptions(ringHasher.Sum32(), searchOwnerRead, ring.WithReplicationFactor(r.SearchRing.ReplicationFactor()))
	if err != nil {
		return false, fmt.Errorf("error getting replicaset from ring: %w", err)
	}

	return rs.Includes(r.Lifecycler.GetInstanceAddr()), nil
}

// PrepareDownscale returns an HTTP handler for the prepare-downscale endpoint.
// This is used by Kubernetes to gracefully remove instances from the ring before scaling down.
func (r *RingState) PrepareDownscale() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			r.Log.Info("Preparing for downscale. Will not keep instance in ring on shutdown.")
			r.Lifecycler.SetKeepInstanceInTheRingOnShutdown(false)
		case http.MethodDelete:
			r.Log.Info("Downscale canceled. Will keep instance in ring on shutdown.")
			r.Lifecycler.SetKeepInstanceInTheRingOnShutdown(true)
		case http.MethodGet:
			// used for delayed downscale use case, which we don't support. Leaving here for completion sake
			r.Log.Info("Received GET request for prepare-downscale. Behavior not implemented.")
		default:
		}
	}
}

// WaitForRingActive waits for the instance to become active in the ring.
// This should be called during service startup after subservices have started.
func (r *RingState) WaitForRingActive(ctx context.Context, timeout time.Duration) error {
	if r == nil || r.Lifecycler == nil {
		return nil
	}

	r.Log.Info("waiting until server is JOINING in the ring")
	lfcCtx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	if err := ring.WaitInstanceState(lfcCtx, r.SearchRing, r.Lifecycler.GetInstanceID(), ring.JOINING); err != nil {
		return fmt.Errorf("error switching to JOINING in the ring: %w", err)
	}
	r.Log.Info("server is JOINING in the ring")

	if err := r.Lifecycler.ChangeState(ctx, ring.ACTIVE); err != nil {
		return fmt.Errorf("error switching to ACTIVE in the ring: %w", err)
	}
	r.Log.Info("server is ACTIVE in the ring")

	return nil
}

// toLifecyclerConfig creates the ring lifecycler configuration from settings.
func toLifecyclerConfig(cfg *setting.Cfg, logger log.Logger) (ring.BasicLifecyclerConfig, error) {
	instanceAddr, err := ring.GetInstanceAddr(cfg.MemberlistBindAddr, netutil.PrivateNetworkInterfacesWithFallback([]string{"eth0", "en0"}, logger), logger, true)
	if err != nil {
		return ring.BasicLifecyclerConfig{}, err
	}

	instanceId := cfg.InstanceID
	if instanceId == "" {
		hostname, err := os.Hostname()
		if err != nil {
			return ring.BasicLifecyclerConfig{}, err
		}

		instanceId = hostname
	}

	_, grpcPortStr, err := net.SplitHostPort(cfg.GRPCServer.Address)
	if err != nil {
		return ring.BasicLifecyclerConfig{}, fmt.Errorf("could not get grpc port from grpc server address: %w", err)
	}

	grpcPort, err := strconv.Atoi(grpcPortStr)
	if err != nil {
		return ring.BasicLifecyclerConfig{}, fmt.Errorf("error converting grpc address port to int: %w", err)
	}

	return ring.BasicLifecyclerConfig{
		Addr:                fmt.Sprintf("%s:%d", instanceAddr, grpcPort),
		ID:                  instanceId,
		HeartbeatPeriod:     15 * time.Second,
		HeartbeatTimeout:    resource.RingHeartbeatTimeout,
		TokensObservePeriod: 0,
		NumTokens:           resource.RingNumTokens,
	}, nil
}
