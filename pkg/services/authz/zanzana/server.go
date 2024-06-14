package zanzana

import (
	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/server"
	"github.com/openfga/openfga/pkg/storage"
)

func New(store storage.OpenFGADatastore) (*server.Server, error) {
	// FIXME(kalleep): add support for more options, configure logging, tracing etc
	opts := []server.OpenFGAServiceV1Option{
		server.WithDatastore(store),
		// FIXME(kalleep): Write and log adapter for open fga logging interface
		server.WithLogger(logger.NewNoopLogger()),
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
