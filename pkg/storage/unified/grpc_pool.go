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
}

// Invoke implements the grpc.ClientConnInterface.Invoke method.
func (pc *pooledClientConn) Invoke(ctx context.Context, method string, args interface{}, reply interface{}, opts ...grpc.CallOption) error {
	conn, err := pc.pool.Get(ctx)
	if err != nil {
		return err
	}
	// Return connection to pool when done.
	defer func() {
		_ = conn.Close()
	}()
	return conn.ClientConn.Invoke(ctx, method, args, reply, opts...)
}

// NewStream implements the grpc.ClientConnInterface.NewStream method.
func (pc *pooledClientConn) NewStream(ctx context.Context, desc *grpc.StreamDesc, method string, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	conn, err := pc.pool.Get(ctx)
	if err != nil {
		return nil, err
	}
	stream, err := conn.ClientConn.NewStream(ctx, desc, method, opts...)
	if err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &pooledClientStream{
		ClientStream: stream,
		conn:         conn,
	}, nil
}

// pooledClientStream wraps a grpc.ClientStream to close the connection when done.
type pooledClientStream struct {
	grpc.ClientStream
	conn *grpcpool.ClientConn
}

// CloseSend closes the stream and returns the connection to the pool.
func (ps *pooledClientStream) CloseSend() error {
	if err := ps.ClientStream.CloseSend(); err != nil {
		return err
	}
	if err := ps.conn.Close(); err != nil {
		return err
	}
	return nil
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

func newResourceClientWithPool(opts *poolOpts) (grpc.ClientConnInterface, error) {
	if err := opts.validate(); err != nil {
		return nil, fmt.Errorf("failed to validate connection pool options: %w", err)
	}
	pool, err := grpcpool.New(opts.factory, opts.initialCapacity, opts.maxCapacity, opts.idleTimeout)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}
	return &pooledClientConn{pool: pool}, nil
}
