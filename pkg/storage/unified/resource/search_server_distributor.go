package resource

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"maps"
	"math/rand"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/fullstorydev/grpchan"
	"github.com/grafana/dskit/backoff"
	"github.com/grafana/dskit/ring"
	ringclient "github.com/grafana/dskit/ring/client"
	"github.com/grafana/dskit/services"
	userutils "github.com/grafana/dskit/user"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type UnifiedStorageGrpcService interface {
	services.NamedService
	grpcserver.HealthProbe
}

var (
	_ UnifiedStorageGrpcService = (*distributorServer)(nil)
)

func ProvideSearchDistributorServer(tracer trace.Tracer, cfg *setting.Cfg, ring *ring.Ring, ringClientPool *ringclient.Pool, provider grpcserver.Provider) (UnifiedStorageGrpcService, error) {
	s := &distributorServer{
		log:            log.New("index-server-distributor"),
		ring:           ring,
		searchRingRead: newSearchRingReadOp(cfg.SearchRingExtendReplicaSet),
		clientPool:     ringClientPool,
		tracing:        tracer,
	}

	srv := provider.GetServer()
	for _, desc := range []*grpc.ServiceDesc{
		&resourcepb.ResourceIndex_ServiceDesc,
		&resourcepb.ManagedObjectIndex_ServiceDesc,
	} {
		if cfg.UnifiedStorageGRPCErrorResultToStatus {
			desc = grpchan.InterceptServer(desc, UnaryErrorResultInterceptor(), nil)
		}
		srv.RegisterService(desc, s)
	}
	_, _ = grpcserver.ProvideReflectionService(cfg, provider)
	s.BasicService = services.NewBasicService(nil, func(ctx context.Context) error {
		ringWatcher := services.NewFailureWatcher()
		ringWatcher.WatchService(s.ring)
		defer ringWatcher.Close()
		if state := s.ring.State(); state != services.Running {
			return fmt.Errorf("ring is not running: state=%s", state)
		}
		select {
		case err := <-ringWatcher.Chan():
			return fmt.Errorf("ring failure: %w", err)
		case <-ctx.Done():
			s.log.Info("Stopping search distributor server")
			return nil
		}
	}, nil).WithName(modules.SearchServerDistributor)
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
	clientPool     *ringclient.Pool
	ring           *ring.Ring
	searchRingRead ring.Operation
	log            log.Logger
	tracing        trace.Tracer
}

// Search servers register as JOINING and become ACTIVE only after building
// their indexes. Requiring an ACTIVE entry would keep distributors unready
// during a cold start or full search-server rollout.
func (ds *distributorServer) ringPopulated() error {
	if state := ds.ring.State(); state != services.Running {
		return fmt.Errorf("ring is not running: state=%s", state)
	}
	if ds.ring.InstancesCount() == 0 {
		return errors.New("search server ring has no instances")
	}
	return nil
}

func (ds *distributorServer) CheckHealth(_ context.Context) (bool, error) {
	err := ds.ringPopulated()
	return err == nil, err
}

func newSearchRingReadOp(extendReplicaSet bool) ring.Operation {
	// The distributor routes search-related requests only to ACTIVE instances.
	// Replica-set extension is configurable to avoid forcing replacement pods to open large local indexes during rollouts.
	var shouldExtendReplicaSet func(ring.InstanceState) bool
	if extendReplicaSet {
		shouldExtendReplicaSet = func(s ring.InstanceState) bool {
			return s != ring.ACTIVE
		}
	}
	return ring.NewOp([]ring.InstanceState{ring.ACTIVE}, shouldExtendReplicaSet)
}

func (ds *distributorServer) Search(ctx context.Context, r *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := ds.tracing.Start(ctx, "distributor.Search")
	defer span.End()
	return distributeWithFailover(ctx, ds, r.Options.Key.Namespace, "Search", r, ResourceClient.Search)
}

func (ds *distributorServer) GetStats(ctx context.Context, r *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	ctx, span := ds.tracing.Start(ctx, "distributor.GetStats")
	defer span.End()
	return distributeWithFailover(ctx, ds, r.Namespace, "GetStats", r, ResourceClient.GetStats)
}

func (ds *distributorServer) VectorSearch(ctx context.Context, r *resourcepb.VectorSearchRequest) (*resourcepb.VectorSearchResponse, error) {
	ctx, span := ds.tracing.Start(ctx, "distributor.VectorSearch")
	defer span.End()

	// No per-namespace locality — every search pod hits the same pgvector
	// backend — so pick any healthy instance.
	rs, err := ds.ring.GetAllHealthy(ds.searchRingRead)
	if err != nil || len(rs.Instances) == 0 {
		return nil, fmt.Errorf("no healthy search instances available: %w", err)
	}
	var ns string
	if r.Key != nil {
		ns = r.Key.Namespace
	}
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		md = make(metadata.MD)
	}
	ctx = userutils.InjectOrgID(metadata.NewOutgoingContext(ctx, md), ns)
	logger := ds.log.New("method", "VectorSearch", "namespace", ns)
	// Any instance can answer, so a few of them are enough for failover.
	instances := shuffled(rs.Instances)
	instances = instances[:min(minDistributeAttempts, len(instances))]
	resp, _, err := callWithRetries(ctx, logger, ds.clientPool, instances, r, ResourceClient.VectorSearch)
	return resp, err
}

// HybridSearch needs the namespace's local bleve index for its lexical
// leg, so it routes namespace-sticky like Search — not random like
// VectorSearch (pgvector is reachable from any pod).
func (ds *distributorServer) HybridSearch(ctx context.Context, r *resourcepb.HybridSearchRequest) (*resourcepb.HybridSearchResponse, error) {
	ctx, span := ds.tracing.Start(ctx, "distributor.HybridSearch")
	defer span.End()

	var ns string
	if r.Key != nil {
		ns = r.Key.Namespace
	}
	return distributeWithFailover(ctx, ds, ns, "HybridSearch", r, ResourceClient.HybridSearch)
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
	rs, err := ds.ring.GetAllHealthy(ds.searchRingRead)
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
	logger := ds.log.New("method", "RebuildIndexes", "namespace", r.Namespace)

	expectedInstances := ds.ring.InstancesCount()
	var wg sync.WaitGroup
	responseCh := make(chan *resourcepb.RebuildIndexesResponse, expectedInstances)
	errorCh := make(chan error, expectedInstances)

	for _, inst := range rs.Instances {
		wg.Go(func() {
			// Every instance must be contacted, so retry the same one instead of failing over.
			rsp, _, err := callWithRetries(rCtx, logger, ds.clientPool, []ring.InstanceDesc{inst}, r, ResourceClient.RebuildIndexes)
			if err := ErrorFromResponse(rsp.GetError(), err); err != nil {
				errorCh <- fmt.Errorf("instance %s: rebuild index request returned the error %w", inst.Id, err)
				return
			}

			// Add instance ID to details if present
			if rsp.Details != "" {
				rsp.Details = fmt.Sprintf("{instance: %s, details: %s}", inst.Id, rsp.Details)
			}

			responseCh <- rsp
		})
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
	return distributeWithFailover(ctx, ds, r.Namespace, "CountManagedObjects", r, ResourceClient.CountManagedObjects)
}

func (ds *distributorServer) ListManagedObjects(ctx context.Context, r *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	ctx, span := ds.tracing.Start(ctx, "distributor.ListManagedObjects")
	defer span.End()
	return distributeWithFailover(ctx, ds, r.Namespace, "ListManagedObjects", r, ResourceClient.ListManagedObjects)
}

const minDistributeAttempts = 3

var distributeBackoff = backoff.Config{MinBackoff: 100 * time.Millisecond, MaxBackoff: time.Second}

// distributeWithFailover sends the request to a random replica owning the
// namespace, and to other replicas if that one fails. We don't send every
// request to all replicas, because that would double the search load.
func distributeWithFailover[Req, Resp any](
	ctx context.Context,
	ds *distributorServer,
	namespace, methodName string,
	req Req,
	call func(ResourceClient, context.Context, Req, ...grpc.CallOption) (Resp, error),
) (Resp, error) {
	var resp Resp

	ringHasher := fnv.New32a()
	_, err := ringHasher.Write([]byte(namespace))
	if err != nil {
		ds.log.Debug("error hashing namespace", "err", err, "namespace", namespace)
		return resp, err
	}

	rs, err := ds.ring.GetWithOptions(ringHasher.Sum32(), ds.searchRingRead, ring.WithReplicationFactor(ds.ring.ReplicationFactor()))
	if err != nil {
		ds.log.Debug("error getting replication set from ring", "err", err, "namespace", namespace)
		return resp, err
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		md = make(metadata.MD)
	}
	outCtx := userutils.InjectOrgID(metadata.NewOutgoingContext(ctx, md), namespace)

	logger := ds.log.New("method", methodName, "namespace", namespace)
	resp, instID, err := callWithRetries(outCtx, logger, ds.clientPool, shuffled(rs.Instances), req, call)

	// Set once, after all attempts, because grpc.SetHeader appends values.
	if err := grpc.SetHeader(ctx, metadata.Pairs("proxied-instance-id", instID)); err != nil {
		ds.log.Debug("error setting grpc header", "err", err)
	}

	return resp, err
}

// callWithRetries calls the instances in order until one succeeds or returns
// an error that another attempt won't fix. Once every instance has been tried,
// it waits and starts again from the first one, so a single instance is retried
// with a backoff. It returns the ID of the last instance it called.
func callWithRetries[Req, Resp any](
	ctx context.Context,
	logger log.Logger,
	pool *ringclient.Pool,
	instances []ring.InstanceDesc,
	req Req,
	call func(ResourceClient, context.Context, Req, ...grpc.CallOption) (Resp, error),
) (Resp, string, error) {
	var (
		resp   Resp
		err    error
		instID string
	)
	// Try every instance once before retrying any of them.
	maxAttempts := max(minDistributeAttempts, len(instances)+1)
	b := backoff.New(ctx, distributeBackoff)
	for attempt := range maxAttempts {
		if attempt > 0 {
			if attempt%len(instances) == 0 {
				b.Wait()
			}
			// The caller gave up, so report that instead of the previous replica's failure.
			if ctxErr := ctx.Err(); ctxErr != nil {
				var zero Resp
				return zero, instID, status.FromContextError(ctxErr).Err()
			}
		}

		inst := instances[attempt%len(instances)]
		instID = inst.Id
		client, clientErr := pool.GetClientForInstance(inst)
		if clientErr != nil {
			err = clientErr
		} else {
			resp, err = call(client.(*RingClient).Client, ctx, req)
		}

		code, failure := callFailure(resp, err)
		// A client pool error means we could not connect to the instance.
		// 429 is not retried: search rate limits are shared by all replicas, and
		// each retry would use up more of the tenant's limit.
		retryable := clientErr != nil || code == http.StatusServiceUnavailable
		if !retryable || attempt == maxAttempts-1 {
			break
		}
		logger.Warn("search instance failed, retrying", "err", failure, "searchApiInstanceId", inst.Id, "attempt", attempt+1)
	}
	return resp, instID, err
}

// callFailure returns the HTTP code and error of a failed call, or 0 and nil
// on success. Search servers can report errors as a gRPC status or inside the
// response, depending on the grpc_error_result_to_status setting.
func callFailure(resp any, err error) (int32, error) {
	if err != nil {
		return AsErrorResult(err).GetCode(), err
	}
	r, ok := resp.(interface {
		GetError() *resourcepb.ErrorResult
	})
	if !ok || r.GetError() == nil {
		return 0, nil
	}
	return r.GetError().GetCode(), GetError(r.GetError())
}

// shuffled returns the instances in random order, which spreads the load
// across replicas and decides which replica is used on failover.
func shuffled(instances []ring.InstanceDesc) []ring.InstanceDesc {
	instances = slices.Clone(instances)
	rand.Shuffle(len(instances), func(i, j int) { instances[i], instances[j] = instances[j], instances[i] })
	return instances
}

func (ds *distributorServer) IsHealthy(ctx context.Context, r *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	if err := ds.ringPopulated(); err == nil {
		return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_SERVING}, nil
	}

	return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_NOT_SERVING}, nil
}
