package unified

import (
	"context"
	"errors"
	"fmt"
	"time"

	grpcpool "github.com/1NCE-GmbH/grpc-go-pool"
	"google.golang.org/grpc"
)

// pooledClientConn implements grpc.ClientConnInterface using a connection from a pool.
type pooledClientConn struct {
	pool *grpcpool.Pool
	// For streaming we want to keep a single connection, as otherwise we saturate the pool.
	// Streaming should only be used for watching.
	streamConn grpc.ClientConnInterface
}

// Invoke implements the grpc.ClientConnInterface.Invoke method.
func (pc *pooledClientConn) Invoke(ctx context.Context, method string, args interface{}, reply interface{}, opts ...grpc.CallOption) error {
	conn, err := pc.pool.Get(ctx)
	if err != nil {
		return fmt.Errorf("failed to create grpc conn in pooled client: %w", err)
	}
	// Return connection to pool when done.
	defer func() {
		_ = conn.Close()
	}()
	return conn.Invoke(ctx, method, args, reply, opts...)
}

// NewStream implements the grpc.ClientConnInterface.NewStream method.
func (pc *pooledClientConn) NewStream(ctx context.Context, desc *grpc.StreamDesc, method string, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	stream, err := pc.streamConn.NewStream(ctx, desc, method, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create grpc stream in pooled client: %w", err)
	}
	return stream, nil
}

type poolOpts struct {
	initialCapacity int
	maxCapacity     int
	idleTimeout     time.Duration
	factory         func() (*grpc.ClientConn, error)
}

func (opts *poolOpts) validate() error {
	if opts.initialCapacity <= 0 {
		return errors.New("initial capacity is required")
	}
	if opts.maxCapacity < opts.initialCapacity {
		return errors.New("max capacity is less than initial capacity")
	}
	if opts.idleTimeout <= 0 {
		return errors.New("idle timeout is required")
	}
	if opts.factory == nil {
		return errors.New("factory is required")
	}
	return nil
}

func newPooledConn(opts *poolOpts) (grpc.ClientConnInterface, error) {
	if err := opts.validate(); err != nil {
		return nil, fmt.Errorf("failed to validate grpc connection pool options: %w", err)
	}
	pool, err := grpcpool.New(opts.factory, opts.initialCapacity, opts.maxCapacity, opts.idleTimeout)
	if err != nil {
		return nil, fmt.Errorf("failed to create grpc connection pool: %w", err)
	}
	streamConn, err := opts.factory()
	if err != nil {
		return nil, fmt.Errorf("failed to create groc streaming connection: %w", err)
	}
	return &pooledClientConn{
		pool:       pool,
		streamConn: streamConn,
	}, nil
}
