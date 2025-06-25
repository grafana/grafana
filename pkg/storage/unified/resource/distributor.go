package resource

import (
	"context"
	"hash/fnv"
	"time"

	"github.com/grafana/dskit/ring"
	ringclient "github.com/grafana/dskit/ring/client"
	"github.com/grafana/dskit/services"
	userutils "github.com/grafana/dskit/user"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
)

func ProvideDistributorServer(cfg *setting.Cfg, features featuremgmt.FeatureToggles, registerer prometheus.Registerer, tracer trace.Tracer, ring *ring.Ring, ringClientPool *ringclient.Pool) (grpcserver.Provider, error) {
	var err error
	grpcHandler, err := grpcserver.ProvideService(cfg, features, nil, tracer, registerer)
	if err != nil {
		return nil, err
	}

	distributorServer := &distributorServer{
		log:        log.New("unified-storage-distributor"),
		ring:       ring,
		clientPool: ringClientPool,
	}

	healthService, err := ProvideHealthService(distributorServer)
	if err != nil {
		return nil, err
	}

	grpcServer := grpcHandler.GetServer()

	resourcepb.RegisterResourceStoreServer(grpcServer, distributorServer)
	// resourcepb.RegisterBulkStoreServer(grpcServer, distributorServer)
	resourcepb.RegisterResourceIndexServer(grpcServer, distributorServer)
	resourcepb.RegisterManagedObjectIndexServer(grpcServer, distributorServer)
	resourcepb.RegisterBlobStoreServer(grpcServer, distributorServer)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthService)
	_, err = grpcserver.ProvideReflectionService(cfg, grpcHandler)
	if err != nil {
		return nil, err
	}

	return grpcHandler, nil
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

const RingKey = "unified-storage-ring"
const RingName = "unified_storage_ring"
const RingHeartbeatTimeout = time.Minute
const RingNumTokens = 128

type distributorServer struct {
	clientPool *ringclient.Pool
	ring       *ring.Ring
	log        log.Logger
}

var ringOp = ring.NewOp([]ring.InstanceState{ring.ACTIVE}, func(s ring.InstanceState) bool {
	return s != ring.ACTIVE
})

func (ds *distributorServer) Search(ctx context.Context, r *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Options.Key.Namespace, "Search")
	if err != nil {
		return nil, err
	}

	return client.Search(ctx, r)
}

func (ds *distributorServer) GetStats(ctx context.Context, r *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Namespace, "GetStats")
	if err != nil {
		return nil, err
	}

	return client.GetStats(ctx, r)
}

func (ds *distributorServer) Read(ctx context.Context, r *resourcepb.ReadRequest) (*resourcepb.ReadResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace, "Read")
	if err != nil {
		return nil, err
	}

	return client.Read(ctx, r)
}

func (ds *distributorServer) Create(ctx context.Context, r *resourcepb.CreateRequest) (*resourcepb.CreateResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace, "Create")
	if err != nil {
		return nil, err
	}

	return client.Create(ctx, r)
}

func (ds *distributorServer) Update(ctx context.Context, r *resourcepb.UpdateRequest) (*resourcepb.UpdateResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace, "Update")
	if err != nil {
		return nil, err
	}

	return client.Update(ctx, r)
}

func (ds *distributorServer) Delete(ctx context.Context, r *resourcepb.DeleteRequest) (*resourcepb.DeleteResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace, "Delete")
	if err != nil {
		return nil, err
	}

	return client.Delete(ctx, r)
}

func (ds *distributorServer) List(ctx context.Context, r *resourcepb.ListRequest) (*resourcepb.ListResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Options.Key.Namespace, "List")
	if err != nil {
		return nil, err
	}

	return client.List(ctx, r)
}

func (ds *distributorServer) Watch(r *resourcepb.WatchRequest, srv resourcepb.ResourceStore_WatchServer) error {
	// r -> consumer watch request
	// srv -> stream connection with consumer
	ctx := srv.Context()
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Options.Key.Namespace, "Watch")
	if err != nil {
		return err
	}

	// watchClient -> stream connection with storage-api pod
	watchClient, err := client.Watch(ctx, r)
	if err != nil {
		return err
	}

	// WARNING
	// in Watch, all messages flow from the resource server (watchClient) to the consumer (srv)
	// but since this is a streaming connection, in theory the consumer could also send a message to the server
	// however for the sake of simplicity we are not handling it here
	// but if we decide to handle bi-directional message passing in this method, we will need to update this
	// we also never handle EOF err, as the server never closes the connection willingly
	for {
		msg, err := watchClient.Recv()
		if err != nil {
			return err
		}
		_ = srv.Send(msg)
	}
}

// TODO implement this if we want to support it in cloud
// func (ds *DistributorServer) BulkProcess(srv BulkStore_BulkProcessServer) error {
// 	return nil
// }

func (ds *distributorServer) CountManagedObjects(ctx context.Context, r *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Namespace, "CountManagedObjects")
	if err != nil {
		return nil, err
	}

	return client.CountManagedObjects(ctx, r)
}

func (ds *distributorServer) ListManagedObjects(ctx context.Context, r *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Namespace, "ListManagedObjects")
	if err != nil {
		return nil, err
	}

	return client.ListManagedObjects(ctx, r)
}

func (ds *distributorServer) PutBlob(ctx context.Context, r *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Resource.Namespace, "PutBlob")
	if err != nil {
		return nil, err
	}

	return client.PutBlob(ctx, r)
}

func (ds *distributorServer) GetBlob(ctx context.Context, r *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Resource.Namespace, "GetBlob")
	if err != nil {
		return nil, err
	}

	return client.GetBlob(ctx, r)
}

func (ds *distributorServer) getClientToDistributeRequest(ctx context.Context, namespace string, methodName string) (context.Context, ResourceClient, error) {
	ringHasher := fnv.New32a()
	_, err := ringHasher.Write([]byte(namespace))
	if err != nil {
		return ctx, nil, err
	}

	rs, err := ds.ring.Get(ringHasher.Sum32(), ringOp, nil, nil, nil)
	if err != nil {
		return ctx, nil, err
	}

	client, err := ds.clientPool.GetClientForInstance(rs.Instances[0])
	if err != nil {
		return ctx, nil, err
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		md = make(metadata.MD)
	}

	ds.log.Info("distributing request to ", "methodName", methodName, "instanceId", rs.Instances[0].Id)

	return userutils.InjectOrgID(metadata.NewOutgoingContext(ctx, md), namespace), client.(*RingClient).Client, nil
}

func (ds *distributorServer) IsHealthy(ctx context.Context, r *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	if ds.ring.State() == services.Running {
		return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_SERVING}, nil
	}

	return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_NOT_SERVING}, nil
}
