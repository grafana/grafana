package server

import (
	"context"
	"fmt"
	"hash/fnv"

	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"

	ringclient "github.com/grafana/dskit/ring/client"
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

	distributor := &Distributor{
		stoppedCh: make(chan error),
	}

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

	distributorServer := &DistributorServer{
		ring:       ms.storageRing,
		clientPool: ms.storageRingClientPool,
	}
	grpcServer := distributor.grpcHandler.GetServer()

	resource.RegisterResourceStoreServer(grpcServer, distributorServer)
	// TODO how to do this
	// resource.RegisterBulkStoreServer(grpcServer, distributorServer)
	resource.RegisterResourceIndexServer(grpcServer, distributorServer)
	resource.RegisterManagedObjectIndexServer(grpcServer, distributorServer)
	resource.RegisterBlobStoreServer(grpcServer, distributorServer)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthService)
	_, err = grpcserver.ProvideReflectionService(ms.cfg, distributor.grpcHandler)
	if err != nil {
		return nil, err
	}

	return services.NewBasicService(distributor.start, distributor.running, nil).WithName(modules.Distributor), nil
}

type Distributor struct {
	grpcHandler grpcserver.Provider
	stoppedCh   chan error
}

func (d *Distributor) start(ctx context.Context) error {
	go func() {
		err := d.grpcHandler.Run(ctx)
		if err != nil {
			d.stoppedCh <- err
		} else {
			d.stoppedCh <- nil
		}
		close(d.stoppedCh)
	}()
	return nil
}

func (d *Distributor) running(ctx context.Context) error {
	select {
	case err := <-d.stoppedCh:
		if err != nil {
			return err
		}
	case <-ctx.Done():
	}
	return nil
}

type DistributorServer struct {
	clientPool *ringclient.Pool
	ring       *ring.Ring
}

var ringOp = ring.NewOp([]ring.InstanceState{ring.ACTIVE}, func(s ring.InstanceState) bool {
	return s != ring.ACTIVE
})

func (ds *DistributorServer) Search(ctx context.Context, r *resource.ResourceSearchRequest) (*resource.ResourceSearchResponse, error) {
	fmt.Println("distributing Search")
	client, err := ds.getClientToDistributeRequest(ctx, r.Options.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.Search(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) GetStats(ctx context.Context, r *resource.ResourceStatsRequest) (*resource.ResourceStatsResponse, error) {
	fmt.Println("distributing GetStats")
	client, err := ds.getClientToDistributeRequest(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}

	return client.GetStats(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) Read(ctx context.Context, r *resource.ReadRequest) (*resource.ReadResponse, error) {
	fmt.Println("distributing Read")
	client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.Read(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) Create(ctx context.Context, r *resource.CreateRequest) (*resource.CreateResponse, error) {
	fmt.Println("distributing Create")
	client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.Create(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) Update(ctx context.Context, r *resource.UpdateRequest) (*resource.UpdateResponse, error) {
	fmt.Println("distributing Update")
	client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.Update(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) Delete(ctx context.Context, r *resource.DeleteRequest) (*resource.DeleteResponse, error) {
	fmt.Println("distributing Delete")
	client, err := ds.getClientToDistributeRequest(ctx, r.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.Delete(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) List(ctx context.Context, r *resource.ListRequest) (*resource.ListResponse, error) {
	fmt.Println("distributing List")
	client, err := ds.getClientToDistributeRequest(ctx, r.Options.Key.Namespace)
	if err != nil {
		return nil, err
	}

	return client.List(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) Watch(r *resource.WatchRequest, srv resource.ResourceStore_WatchServer) error {
	fmt.Println("distributing Watch")
	return nil
	// ctx := srv.Context()

	// client, err := ds.getClientToDistributeRequest(ctx, r.Options.Key.Namespace)
	// if err != nil {
	// 	return err
	// }

	// return client.Watch(r, srv)
}

// TODO how to do this
// func (ds *DistributorServer) BulkProcess(r *resource.WatchRequest, srv resource.ResourceStore_WatchServer) error {
// 	return nil
// }

func (ds *DistributorServer) CountManagedObjects(ctx context.Context, r *resource.CountManagedObjectsRequest) (*resource.CountManagedObjectsResponse, error) {
	client, err := ds.getClientToDistributeRequest(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}

	return client.CountManagedObjects(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) ListManagedObjects(ctx context.Context, r *resource.ListManagedObjectsRequest) (*resource.ListManagedObjectsResponse, error) {
	client, err := ds.getClientToDistributeRequest(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}

	return client.ListManagedObjects(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) PutBlob(ctx context.Context, r *resource.PutBlobRequest) (*resource.PutBlobResponse, error) {
	client, err := ds.getClientToDistributeRequest(ctx, r.Resource.Namespace)
	if err != nil {
		return nil, err
	}

	return client.PutBlob(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) GetBlob(ctx context.Context, r *resource.GetBlobRequest) (*resource.GetBlobResponse, error) {
	client, err := ds.getClientToDistributeRequest(ctx, r.Resource.Namespace)
	if err != nil {
		return nil, err
	}

	return client.GetBlob(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) getClientToDistributeRequest(ctx context.Context, namespace string) (resource.ResourceClient, error) {
	ringHasher := fnv.New32a()
	_, err := ringHasher.Write([]byte(namespace))
	if err != nil {
		return nil, err
	}

	rs, err := ds.ring.Get(ringHasher.Sum32(), ringOp, nil, nil, nil)
	if err != nil {
		return nil, err
	}

	client, err := ds.clientPool.GetClientForInstance(rs.Instances[0])
	if err != nil {
		return nil, err
	}

	fmt.Println("distributing request to ", rs.Instances[0].Id)

	return client.(*resource.RingClient).Client, nil
}

type healthServer struct{}

func (hs *healthServer) IsHealthy(ctx context.Context, r *resource.HealthCheckRequest) (*resource.HealthCheckResponse, error) {
	return &resource.HealthCheckResponse{Status: resource.HealthCheckResponse_SERVING}, nil
}
