package unified

import (
	"context"
	"fmt"
	"time"

	grpcpool "github.com/1NCE-GmbH/grpc-go-pool"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
)

// PooledClientConn implements grpc.ClientConnInterface using a connection from a pool
type PooledClientConn struct {
	pool *grpcpool.Pool
}

// Invoke implements the grpc.ClientConnInterface.Invoke method
func (pc *PooledClientConn) Invoke(ctx context.Context, method string, args interface{}, reply interface{}, opts ...grpc.CallOption) error {
	// Get a connection from the pool
	conn, err := pc.pool.Get(ctx)
	if err != nil {
		return err
	}
	// Return connection to pool when done
	defer func() {
		_ = conn.Close()
	}()

	// Use the connection for the RPC call
	return conn.ClientConn.Invoke(ctx, method, args, reply, opts...)
}

// NewStream implements the grpc.ClientConnInterface.NewStream method
func (pc *PooledClientConn) NewStream(ctx context.Context, desc *grpc.StreamDesc, method string, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	// Get a connection from the pool
	conn, err := pc.pool.Get(ctx)
	if err != nil {
		return nil, err
	}

	// Use the connection to create a stream
	stream, err := conn.ClientConn.NewStream(ctx, desc, method, opts...)
	if err != nil {
		_ = conn.Close() // Return connection on error
		return nil, err
	}

	// Wrap the stream to close the connection when the stream is done
	return &pooledClientStream{
		ClientStream: stream,
		conn:         conn,
	}, nil
}

// pooledClientStream wraps a grpc.ClientStream to close the connection when done
type pooledClientStream struct {
	grpc.ClientStream
	conn *grpcpool.ClientConn
}

// CloseSend closes the stream and returns the connection to the pool
func (ps *pooledClientStream) CloseSend() error {
	if err := ps.ClientStream.CloseSend(); err != nil {
		return err
	}
	// Return connection to pool
	if err := ps.conn.Close(); err != nil {
		return err
	}
	return nil
}

func NewResourceClientWithPool(address string, reg prometheus.Registerer) (grpc.ClientConnInterface, error) {
	factory := func() (*grpc.ClientConn, error) {
		return GrpcConn(address, reg)
	}

	pool, err := grpcpool.New(factory, 10, 20, 5*time.Minute)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Create a pooled connection interface
	return &PooledClientConn{pool: pool}, nil
}
