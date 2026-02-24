package resource

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"maps"
	"math/rand"
	"slices"
	"sync"
	"time"

	"github.com/grafana/dskit/ring"
	ringclient "github.com/grafana/dskit/ring/client"
	"github.com/grafana/dskit/services"
	userutils "github.com/grafana/dskit/user"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type UnifiedStorageGrpcService interface {
	services.NamedService
}

var (
	_ UnifiedStorageGrpcService = (*distributorServer)(nil)
)

func ProvideSearchDistributorServer(tracer trace.Tracer, cfg *setting.Cfg, ring *ring.Ring, ringClientPool *ringclient.Pool, provider grpcserver.Provider) (UnifiedStorageGrpcService, error) {
	s := &distributorServer{
		log:        log.New("index-server-distributor"),
		ring:       ring,
		clientPool: ringClientPool,
		tracing:    tracer,
	}

	healthService, err := ProvideHealthService(s)
	if err != nil {
		return nil, err
	}

	srv := provider.GetServer()
	resourcepb.RegisterResourceIndexServer(srv, s)
	resourcepb.RegisterManagedObjectIndexServer(srv, s)
	grpc_health_v1.RegisterHealthServer(srv, healthService)
	_, _ = grpcserver.ProvideReflectionService(cfg, provider)

	s.BasicService = services.NewIdleService(nil, nil).WithName(modules.SearchServerDistributor)
	return s, nil
}

type RingClient struct {
	Client ResourceClient
	grpc_health_v1.HealthClient
	Conn *grpc.ClientConn
}

func (c *RingClient) Close() error {
	return c.Conn.Close()
}

func (c *RingClient) String() string {
	return c.RemoteAddress()
}

func (c *RingClient) RemoteAddress() string {
	return c.Conn.Target()
}

const RingKey = "search-server-ring"
const RingName = "search_server_ring"
const RingHeartbeatTimeout = time.Minute
const RingNumTokens = 128

type distributorServer struct {
	*services.BasicService
	clientPool *ringclient.Pool
	ring       *ring.Ring
	log        log.Logger
	tracing    trace.Tracer
}

var (
	// operation used by the distributor to select only ACTIVE instances to handle search-related requests
	searchRingRead = ring.NewOp([]ring.InstanceState{ring.ACTIVE}, func(s ring.InstanceState) bool {
		return s != ring.ACTIVE
	})
)

func (ds *distributorServer) Search(ctx context.Context, r *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := ds.tracing.Start(ctx, "distributor.Search")
	defer span.End()
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Options.Key.Namespace, "Search")
	if err != nil {
		return nil, err
	}

	return client.Search(ctx, r)
}

func (ds *distributorServer) GetStats(ctx context.Context, r *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	ctx, span := ds.tracing.Start(ctx, "distributor.GetStats")
	defer span.End()
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Namespace, "GetStats")
	if err != nil {
		return nil, err
	}

	return client.GetStats(ctx, r)
}

func (ds *distributorServer) RebuildIndexes(ctx context.Context, r *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	ctx, span := ds.tracing.Start(ctx, "distributor.RebuildIndexes")
	defer span.End()

	// validate input
	for _, key := range r.Keys {
		if r.Namespace != key.Namespace {
			return &resourcepb.RebuildIndexesResponse{
				Error: NewBadRequestError("key namespace does not match request namespace"),
			}, nil
		}
	}

	// distribute the request to all search pods to minimize risk of stale index
	// it will not rebuild on those which don't have the index open
	rs, err := ds.ring.GetAllHealthy(searchRingRead)
	if err != nil {
		return nil, fmt.Errorf("failed to get all healthy instances from the ring")
	}

	err = grpc.SetHeader(ctx, metadata.Pairs("proxied-instance-id", "all"))
	if err != nil {
		ds.log.Debug("error setting grpc header", "err", err)
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		md = make(metadata.MD)
	}
	rCtx := userutils.InjectOrgID(metadata.NewOutgoingContext(ctx, md), r.Namespace)

	expectedInstances := ds.ring.InstancesCount()
	var wg sync.WaitGroup
	responseCh := make(chan *resourcepb.RebuildIndexesResponse, expectedInstances)
	errorCh := make(chan error, expectedInstances)

	for _, inst := range rs.Instances {
		wg.Add(1)
		go func() {
			defer wg.Done()

			client, err := ds.clientPool.GetClientForInstance(inst)
			if err != nil {
				errorCh <- fmt.Errorf("instance %s: failed to get client, %w", inst.Id, err)
				return
			}

			rsp, err := client.(*RingClient).Client.RebuildIndexes(rCtx, r)
			if err != nil {
				errorCh <- fmt.Errorf("instance %s: failed to distribute rebuild index request, %w", inst.Id, err)
				return
			}

			if rsp.Error != nil {
				errorCh <- fmt.Errorf("instance %s: rebuild index request returned the error %s", inst.Id, rsp.Error.Message)
				return
			}

			// Add instance ID to details if present
			if rsp.Details != "" {
				rsp.Details = fmt.Sprintf("{instance: %s, details: %s}", inst.Id, rsp.Details)
			}

			responseCh <- rsp
		}()
	}

	wg.Wait()
	close(errorCh)
	close(responseCh)

	// Collect errors
	errs := make([]error, 0, len(errorCh))
	for err := range errorCh {
		ds.log.Error("rebuild indexes call failed", "error", err)
		errs = append(errs, err)
	}

	// Aggregate responses
	var totalRebuildCount int64
	var details string
	minBuildTimes := make(map[string]*resourcepb.RebuildIndexesResponse_IndexBuildTime)
	contactedInstances := len(responseCh)

	for rsp := range responseCh {
		totalRebuildCount += rsp.RebuildCount

		if rsp.Details != "" {
			if len(details) > 0 {
				details += ", "
			}
			details += rsp.Details
		}

		// Compute MIN(build time) for each resource type
		for _, bt := range rsp.BuildTimes {
			key := bt.Group + "/" + bt.Resource
			existing, found := minBuildTimes[key]
			if !found || bt.BuildTimeUnix < existing.BuildTimeUnix {
				minBuildTimes[key] = bt
			}
		}
	}

	// Convert map to slice
	buildTimes := slices.Collect(maps.Values(minBuildTimes))

	// Determine if all instances were contacted
	contactedAllInstances := contactedInstances == expectedInstances && expectedInstances > 0

	response := &resourcepb.RebuildIndexesResponse{
		RebuildCount:          totalRebuildCount,
		Details:               details,
		BuildTimes:            buildTimes,
		ContactedAllInstances: contactedAllInstances,
	}
	if len(errs) > 0 {
		response.Error = AsErrorResult(errors.Join(errs...))
	}
	return response, nil
}

func (ds *distributorServer) CountManagedObjects(ctx context.Context, r *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	ctx, span := ds.tracing.Start(ctx, "distributor.CountManagedObjects")
	defer span.End()
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Namespace, "CountManagedObjects")
	if err != nil {
		return nil, err
	}

	return client.CountManagedObjects(ctx, r)
}

func (ds *distributorServer) ListManagedObjects(ctx context.Context, r *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	ctx, span := ds.tracing.Start(ctx, "distributor.ListManagedObjects")
	defer span.End()
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Namespace, "ListManagedObjects")
	if err != nil {
		return nil, err
	}

	return client.ListManagedObjects(ctx, r)
}

func (ds *distributorServer) getClientToDistributeRequest(ctx context.Context, namespace string, methodName string) (context.Context, ResourceClient, error) {
	ringHasher := fnv.New32a()
	_, err := ringHasher.Write([]byte(namespace))
	if err != nil {
		ds.log.Debug("error hashing namespace", "err", err, "namespace", namespace)
		return ctx, nil, err
	}

	rs, err := ds.ring.GetWithOptions(ringHasher.Sum32(), searchRingRead, ring.WithReplicationFactor(ds.ring.ReplicationFactor()))
	if err != nil {
		ds.log.Debug("error getting replication set from ring", "err", err, "namespace", namespace)
		return ctx, nil, err
	}

	// Randomly select an instance for primitive load balancing
	inst := rs.Instances[rand.Intn(len(rs.Instances))]
	client, err := ds.clientPool.GetClientForInstance(inst)
	if err != nil {
		ds.log.Debug("error getting instance client from pool", "err", err, "namespace", namespace, "searchApiInstanceId", inst.Id)
		return ctx, nil, err
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		md = make(metadata.MD)
	}

	err = grpc.SetHeader(ctx, metadata.Pairs("proxied-instance-id", inst.Id))
	if err != nil {
		ds.log.Debug("error setting grpc header", "err", err)
	}

	return userutils.InjectOrgID(metadata.NewOutgoingContext(ctx, md), namespace), client.(*RingClient).Client, nil
}

func (ds *distributorServer) IsHealthy(ctx context.Context, r *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	if ds.ring.State() == services.Running {
		return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_SERVING}, nil
	}

	return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_NOT_SERVING}, nil
}
