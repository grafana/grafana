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
		ring: ms.storageRing,
		clientPool: ms.storageRingClientPool,
	}

	resource.RegisterResourceIndexServer(distributor.grpcHandler.GetServer(), distributorServer)
	grpc_health_v1.RegisterHealthServer(distributor.grpcHandler.GetServer(), healthService)
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
	ringHasher := fnv.New32a()
	_, err := ringHasher.Write([]byte(r.Options.Key.Namespace))
	if err != nil {
		fmt.Println("error hashing namespace ", err)
		return nil, err
	}
	rs, err := ds.ring.Get(ringHasher.Sum32(), ringOp, nil, nil, nil)

	if err != nil {
		fmt.Println("err getting replication set ", err)
		return nil, err
	}

	client, err := ds.clientPool.GetClientForInstance(rs.Instances[0])
	if err != nil {
		fmt.Println("error getting client from pool: ", err)
		return nil, err
	}

	return client.(*resource.RingClient).Client.Search(userutils.InjectOrgID(ctx, "1"), r)
}

func (ds *DistributorServer) GetStats(ctx context.Context, r *resource.ResourceStatsRequest) (*resource.ResourceStatsResponse, error) {
	fmt.Println("get stats!!")
	return nil, nil
}

type healthServer struct{}

func (hs *healthServer) IsHealthy(ctx context.Context, r *resource.HealthCheckRequest) (*resource.HealthCheckResponse, error) {
	return &resource.HealthCheckResponse{Status: resource.HealthCheckResponse_SERVING}, nil
}
