package server

import (
	"context"
	"hash/fnv"

	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
	ringclient "github.com/grafana/dskit/ring/client"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/storage/unified/resource"

	userutils "github.com/grafana/dskit/user"
	resourcegrpc "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/sql"

	"go.opentelemetry.io/otel"
	"google.golang.org/grpc/health/grpc_health_v1"
)

func (ms *ModuleServer) initDistributor() (services.Service, error) {
	tracer := otel.Tracer("unified-storage-distributor")

	distributor := &distributorService{}

	// FIXME: This is a temporary solution while we are migrating to the new authn interceptor
	// grpcutils.NewGrpcAuthenticator should be used instead.
	authn := sql.NewAuthenticatorWithFallback(ms.cfg, ms.registerer, tracer, func(ctx context.Context) (context.Context, error) {
		auth := resourcegrpc.Authenticator{Tracer: tracer}
		return auth.Authenticate(ctx)
	})

	var err error
	distributor.grpcHandler, err = grpcserver.ProvideService(ms.cfg, ms.features, interceptors.AuthenticatorFunc(authn), tracer, ms.registerer)
	if err != nil {
		return nil, err
	}

	healthServer := &healthServer{}
	healthService, err := resource.ProvideHealthService(healthServer)
	if err != nil {
		return nil, err
	}

	distributorServer := &distributorServer{
		log:        log.New("unified-storage-distributor"),
		ring:       ms.storageRing,
		clientPool: ms.storageRingClientPool,
	}
	grpcServer := distributor.grpcHandler.GetServer()

	resource.RegisterResourceStoreServer(grpcServer, distributorServer)
	// resource.RegisterBulkStoreServer(grpcServer, distributorServer)
	resource.RegisterResourceIndexServer(grpcServer, distributorServer)
	resource.RegisterManagedObjectIndexServer(grpcServer, distributorServer)
	resource.RegisterBlobStoreServer(grpcServer, distributorServer)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthService)
	_, err = grpcserver.ProvideReflectionService(ms.cfg, distributor.grpcHandler)
	if err != nil {
		return nil, err
	}

	return services.NewBasicService(nil, distributor.running, nil).WithName(modules.Distributor), nil
}

type distributorService struct {
	grpcHandler grpcserver.Provider
}

func (d *distributorService) running(ctx context.Context) error {
	return d.grpcHandler.Run(ctx)
}

type distributorServer struct {
	clientPool *ringclient.Pool
	ring       *ring.Ring
	log        log.Logger
}

var ringOp = ring.NewOp([]ring.InstanceState{ring.ACTIVE}, func(s ring.InstanceState) bool {
	return s != ring.ACTIVE
})

func (ds *distributorServer) Search(ctx context.Context, r *resource.ResourceSearchRequest) (*resource.ResourceSearchResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Options.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.Search(ctx, r)
}

func (ds *distributorServer) GetStats(ctx context.Context, r *resource.ResourceStatsRequest) (*resource.ResourceStatsResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}

	return client.GetStats(ctx, r)
}

func (ds *distributorServer) Read(ctx context.Context, r *resource.ReadRequest) (*resource.ReadResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.Read(ctx, r)
}

func (ds *distributorServer) Create(ctx context.Context, r *resource.CreateRequest) (*resource.CreateResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.Create(ctx, r)
}

func (ds *distributorServer) Update(ctx context.Context, r *resource.UpdateRequest) (*resource.UpdateResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.Update(ctx, r)
}

func (ds *distributorServer) Delete(ctx context.Context, r *resource.DeleteRequest) (*resource.DeleteResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.Delete(ctx, r)
}

func (ds *distributorServer) List(ctx context.Context, r *resource.ListRequest) (*resource.ListResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Options.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.List(ctx, r)
}

func (ds *distributorServer) Watch(r *resource.WatchRequest, srv resource.ResourceStore_WatchServer) error {
	// r -> consumer watch request
	// srv -> stream connection with consumer
	ctx := srv.Context()
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Options.Key.Namespace)
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
		srv.Send(msg)
	}
}

// TODO implement this if we want to support it in cloud
// func (ds *DistributorServer) BulkProcess(srv resource.BulkStore_BulkProcessServer) error {
// 	return nil
// }

func (ds *distributorServer) CountManagedObjects(ctx context.Context, r *resource.CountManagedObjectsRequest) (*resource.CountManagedObjectsResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}

	return client.CountManagedObjects(ctx, r)
}

func (ds *distributorServer) ListManagedObjects(ctx context.Context, r *resource.ListManagedObjectsRequest) (*resource.ListManagedObjectsResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}

	return client.ListManagedObjects(ctx, r)
}

func (ds *distributorServer) PutBlob(ctx context.Context, r *resource.PutBlobRequest) (*resource.PutBlobResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Resource.Namespace)
	if err != nil {
		return nil, err
	}

	return client.PutBlob(ctx, r)
}

func (ds *distributorServer) GetBlob(ctx context.Context, r *resource.GetBlobRequest) (*resource.GetBlobResponse, error) {
	ctx, client, err := ds.getClientToDistributeRequest(ctx, r.Resource.Namespace)
	if err != nil {
		return nil, err
	}

	return client.GetBlob(ctx, r)
}

func (ds *distributorServer) getClientToDistributeRequest(ctx context.Context, namespace string) (context.Context, resource.ResourceClient, error) {
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

	ds.log.Info("distributing request to ", "instanceId", rs.Instances[0].Id)

	return userutils.InjectOrgID(ctx, namespace), client.(*resource.RingClient).Client, nil
}

type healthServer struct{}

func (hs *healthServer) IsHealthy(ctx context.Context, r *resource.HealthCheckRequest) (*resource.HealthCheckResponse, error) {
	return &resource.HealthCheckResponse{Status: resource.HealthCheckResponse_SERVING}, nil
}
