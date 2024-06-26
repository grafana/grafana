package zanzana

import (
	"github.com/openfga/openfga/pkg/server"
	"github.com/openfga/openfga/pkg/storage"

	"github.com/grafana/grafana/pkg/infra/log"
)

func NewServer(store storage.OpenFGADatastore, logger log.Logger) (*server.Server, error) {
	// FIXME(kalleep): add support for more options, tracing etc
	opts := []server.OpenFGAServiceV1Option{
		server.WithDatastore(store),
		server.WithLogger(newZanzanaLogger(logger)),
	}

	// FIXME(kalleep): Interceptors
	// We probably need to at least need to add store id interceptor also
	// would be nice to inject our own requestid?
	srv, err := server.NewServerWithOpts(opts...)
	if err != nil {
		return nil, err
	}

	return srv, nil
}
