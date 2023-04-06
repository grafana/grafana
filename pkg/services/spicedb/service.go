package spicedb

import (
	"context"

	"github.com/authzed/spicedb/pkg/cmd/server"
	"github.com/authzed/spicedb/pkg/cmd/util"
	"github.com/authzed/spicedb/pkg/middleware/logging"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
)

type SpiceDB struct {
	*services.BasicService
	log    log.Logger
	server server.RunnableServer
	errors chan error
}

func ProvideService() *SpiceDB {
	s := &SpiceDB{
		log: log.New("spicedb"),
	}
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping)
	return s
}

func (s *SpiceDB) starting(ctx context.Context) error {
	srv, err := server.NewConfigWithOptions(
		//server.WithDatastore(ds),
		server.WithDispatchMaxDepth(50),
		server.WithMaximumPreconditionCount(1000),
		server.WithMaximumUpdatesPerWrite(1000),
		server.WithMaxCaveatContextSize(4096),
		server.WithGRPCServer(util.GRPCServerConfig{
			Network: util.BufferedNetwork,
			Enabled: true,
		}),
		server.WithSchemaPrefixesRequired(true),
		server.WithGRPCAuthFunc(func(ctx context.Context) (context.Context, error) {
			return ctx, nil
		}),
		server.WithHTTPGateway(util.HTTPServerConfig{Enabled: false}),
		server.WithDashboardAPI(util.HTTPServerConfig{Enabled: false}),
		server.WithMetricsAPI(util.HTTPServerConfig{Enabled: false}),
		server.WithDispatchServer(util.GRPCServerConfig{Enabled: false}),
		server.SetMiddlewareModification([]server.MiddlewareModification{
			{
				Operation: server.OperationReplaceAllUnsafe,
				Middlewares: []server.ReferenceableMiddleware{
					{
						Name:                "logging",
						UnaryMiddleware:     logging.UnaryServerInterceptor(),
						StreamingMiddleware: logging.StreamServerInterceptor(),
					},
				},
			},
		}),
	).Complete(ctx)

	if err != nil {
		return err
	}

	go func() {
		s.errors <- srv.Run(ctx)
	}()

	return nil
}

func (s *SpiceDB) running(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return nil
	case err := <-s.errors:
		return err
	}
}

func (s *SpiceDB) stopping(_ error) error {
	return nil
}
