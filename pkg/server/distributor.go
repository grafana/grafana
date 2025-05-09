package server

import (
	"context"
	"fmt"
	"hash/fnv"
	"io"
	"net"

	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"

	ringclient "github.com/grafana/dskit/ring/client"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/storage/unified/resource"

	userutils "github.com/grafana/dskit/user"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

func (ms *ModuleServer) initDistributor() (services.Service, error) {
	// tracer := otel.Tracer("unified-storage-distributor")

	distributor := &Distributor{
		cfg:       ms.cfg.GRPCServer,
		stoppedCh: make(chan error),
		logger:    log.New("distributor-grpc-server"),
	}

	// FIXME: This is a temporary solution while we are migrating to the new authn interceptor
	// grpcutils.NewGrpcAuthenticator should be used instead.
	// authn := sql.NewAuthenticatorWithFallback(ms.cfg, ms.registerer, tracer, func(ctx context.Context) (context.Context, error) {
	// 	auth := resourcegrpc.Authenticator{Tracer: tracer}
	// 	return auth.Authenticate(ctx)
	// })

	distributorServer := &DistributorServer{
		ring:       ms.storageRing,
		clientPool: ms.storageRingClientPool,
	}

	opts := []grpc.ServerOption{
		grpc.UnknownServiceHandler(distributorServer.handler),
		// grpc.ChainUnaryInterceptor(
		// 	grpcAuth.UnaryServerInterceptor(interceptors.AuthenticatorFunc(authn).Authenticate),
		// ),
	}
	distributor.grpcServer = grpc.NewServer(opts...) // grpcserver.ProvideService(ms.cfg, ms.features, interceptors.AuthenticatorFunc(authn), tracer, ms.registerer)

	healthServer := &healthServer{}
	healthService, err := resource.ProvideHealthService(healthServer)
	if err != nil {
		return nil, err
	}

	grpcServer := distributor.grpcServer

	// resource.RegisterResourceStoreServer(grpcServer, distributorServer)
	// TODO how to do this
	// resource.RegisterBulkStoreServer(grpcServer, distributorServer)
	// resource.RegisterResourceIndexServer(grpcServer, distributorServer)
	// resource.RegisterManagedObjectIndexServer(grpcServer, distributorServer)
	// resource.RegisterBlobStoreServer(grpcServer, distributorServer)
	grpc_health_v1.RegisterHealthServer(grpcServer, healthService)
	// grpc_reflection_v1alpha.RegisterServerReflectionServer(distributor.grpcServer, reflection.NewServer(reflection.ServerOptions{Services: distributor.grpcServer}))

	return services.NewBasicService(distributor.start, distributor.running, nil).WithName(modules.Distributor), nil
}

type Distributor struct {
	cfg        setting.GRPCServerSettings
	grpcServer *grpc.Server
	stoppedCh  chan error
	logger     log.Logger
}

func (d *Distributor) start(ctx context.Context) error {
	// s.logger.Info("Running GRPC server", "address", s.cfg.Address, "network", s.cfg.Network, "tls", s.cfg.TLSConfig != nil, "max_recv_msg_size", s.cfg.MaxRecvMsgSize, "max_send_msg_size", s.cfg.MaxSendMsgSize)
	d.logger.Info("Running Distributor GRPC server")

	listener, err := net.Listen(d.cfg.Network, d.cfg.Address)
	if err != nil {
		return fmt.Errorf("GRPC server: failed to listen: %w", err)
	}

	go func() {
		d.logger.Info("GRPC server: starting")
		err := d.grpcServer.Serve(listener)
		if err != nil {
			d.logger.Error("GRPC server: failed to serve", "err", err)
			d.stoppedCh <- err
		}
	}()

	select {
	case err := <-d.stoppedCh:
		d.logger.Error("GRPC server: failed to serve", "err", err)
		return err
	case <-ctx.Done():
	}
	d.logger.Warn("GRPC server: shutting down")
	d.grpcServer.Stop()
	// close channel?
	return ctx.Err()
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

var (
	clientStreamDescForProxying = &grpc.StreamDesc{
		ServerStreams: true,
		ClientStreams: true,
	}
)

func (ds *DistributorServer) handler(srv interface{}, serverStream grpc.ServerStream) error {
	fullMethodName, ok := grpc.MethodFromServerStream(serverStream)
	if !ok {
		return status.Errorf(codes.Internal, "missing method name")
	}

	namespace := ds.getNamespaceFromContext(serverStream.Context())

	// TODO if namespace is not present or is *, assign random pod for now
	conn, err := ds.getClientConnToDistributeRequest(serverStream.Context(), namespace)
	if err != nil {
		return err
	}

	md, _ := metadata.FromIncomingContext(serverStream.Context())
	outCtx := metadata.NewOutgoingContext(serverStream.Context(), md.Copy())
	clientCtx, clientCancel := context.WithCancel(outCtx)
	defer clientCancel()

	clientStream, err := conn.NewStream(userutils.InjectOrgID(clientCtx, "1"), clientStreamDescForProxying, fullMethodName)
	if err != nil {
		return err
	}

	s2cErrChan := ds.forwardServerToClient(serverStream, clientStream)
	c2sErrChan := ds.forwardClientToServer(clientStream, serverStream)
	// We don't know which side is going to stop sending first, so we need a select between the two.
	for i := 0; i < 2; i++ {
		select {
		case s2cErr := <-s2cErrChan:
			if s2cErr == io.EOF {
				// this is the happy case where the sender has encountered io.EOF, and won't be sending anymore./
				// the clientStream>serverStream may continue pumping though.
				clientStream.CloseSend()
			} else {
				// however, we may have gotten a receive error (stream disconnected, a read error etc) in which case we need
				// to cancel the clientStream to the backend, let all of its goroutines be freed up by the CancelFunc and
				// exit with an error to the stack
				clientCancel()
				return status.Errorf(codes.Internal, "failed proxying s2c: %v", s2cErr)
			}
		case c2sErr := <-c2sErrChan:
			// This happens when the clientStream has nothing else to offer (io.EOF), returned a gRPC error. In those two
			// cases we may have received Trailers as part of the call. In case of other errors (stream closed) the trailers
			// will be nil.
			serverStream.SetTrailer(clientStream.Trailer())
			// c2sErr will contain RPC error from client code. If not io.EOF return the RPC error as server stream error.
			if c2sErr != io.EOF {
				return c2sErr
			}
			return nil
		}
	}
	return status.Errorf(codes.Internal, "gRPC proxying should never reach this stage.")
}

func (ds *DistributorServer) forwardClientToServer(src grpc.ClientStream, dst grpc.ServerStream) chan error {
	ret := make(chan error, 1)
	go func() {
		f := &emptypb.Empty{}
		for i := 0; ; i++ {
			if err := src.RecvMsg(f); err != nil {
				ret <- err // this can be io.EOF which is happy case
				break
			}
			if i == 0 {
				// This is a bit of a hack, but client to server headers are only readable after first client msg is
				// received but must be written to server stream before the first msg is flushed.
				// This is the only place to do it nicely.
				md, err := src.Header()
				if err != nil {
					ret <- err
					break
				}
				if err := dst.SendHeader(md); err != nil {
					ret <- err
					break
				}
			}
			if err := dst.SendMsg(f); err != nil {
				ret <- err
				break
			}
		}
	}()
	return ret
}

func (ds *DistributorServer) forwardServerToClient(src grpc.ServerStream, dst grpc.ClientStream) chan error {
	ret := make(chan error, 1)
	go func() {
		f := &emptypb.Empty{}
		for i := 0; ; i++ {
			if err := src.RecvMsg(f); err != nil {
				ret <- err // this can be io.EOF which is happy case
				break
			}
			if err := dst.SendMsg(f); err != nil {
				ret <- err
				break
			}
		}
	}()
	return ret
}

func (ds *DistributorServer) getNamespaceFromContext(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}

	if namespace := md.Get("namespace"); len(namespace) > 0 {
		if namespace[0] == "*" {
			return ""
		}

		return namespace[0]
	} else {
		return ""
	}
}

func (ds *DistributorServer) getClientConnToDistributeRequest(ctx context.Context, namespace string) (*grpc.ClientConn, error) {
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

	return client.(*ringClient).conn, nil
}

type healthServer struct{}

func (hs *healthServer) IsHealthy(ctx context.Context, r *resource.HealthCheckRequest) (*resource.HealthCheckResponse, error) {
	return &resource.HealthCheckResponse{Status: resource.HealthCheckResponse_SERVING}, nil
}
