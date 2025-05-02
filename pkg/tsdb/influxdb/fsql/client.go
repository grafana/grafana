package fsql

import (
	"context"
	"crypto/x509"
	"fmt"
	"net"
	"sync"

	"github.com/apache/arrow-go/v18/arrow/flight"
	"github.com/apache/arrow-go/v18/arrow/flight/flightsql"
	"github.com/apache/arrow-go/v18/arrow/ipc"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

type client struct {
	*flightsql.Client
	md metadata.MD
}

// FlightClient returns the underlying [flight.Client].
func (c *client) FlightClient() flight.Client {
	return c.Client.Client
}

func newFlightSQLClient(addr string, metadata metadata.MD, secure bool, proxyClient proxy.Client) (*client, error) {
	dialOptions, err := grpcDialOptions(secure, proxyClient)
	if err != nil {
		return nil, fmt.Errorf("grpc dial options: %s", err)
	}

	// If the secure socks proxy is enabled, we add the passthrough scheme. Otherwise, we use the raw address.
	// This ensures the address is passed directly to the transport rather than trying to resolve via DNS.
	if proxyClient.SecureSocksProxyEnabled() {
		addr = fmt.Sprintf("passthrough:///%s", addr)
	}
	fsqlClient, err := flightsql.NewClient(addr, nil, nil, dialOptions...)
	if err != nil {
		return nil, err
	}
	return &client{Client: fsqlClient, md: metadata}, nil
}

func grpcDialOptions(secure bool, proxyClient proxy.Client) ([]grpc.DialOption, error) {
	dialOptions := []grpc.DialOption{}
	secureDialOpt := grpc.WithTransportCredentials(insecure.NewCredentials())

	if secure {
		pool, err := x509.SystemCertPool()
		if err != nil {
			return nil, fmt.Errorf("x509: %s", err)
		}
		secureDialOpt = grpc.WithTransportCredentials(credentials.NewClientTLSFromCert(pool, ""))
	}
	dialOptions = append(dialOptions, secureDialOpt)

	if proxyClient.SecureSocksProxyEnabled() {
		dialer, err := proxyClient.NewSecureSocksProxyContextDialer()
		if err != nil {
			return nil, fmt.Errorf("failed to create influx proxy dialer: %s", err)
		}

		dialOptions = append(dialOptions, grpc.WithContextDialer(func(ctx context.Context, host string) (net.Conn, error) {
			logger := glog.FromContext(ctx)
			logger.Debug("Dialing secure socks proxy", "host", host)
			conn, err := dialer.Dial("tcp", host)
			if err != nil {
				return nil, fmt.Errorf("not possible to dial secure socks proxy: %w", err)
			}
			select {
			case <-ctx.Done():
				return conn, fmt.Errorf("context canceled: %w", err)
			default:
				return conn, nil
			}
		}))
	}

	return dialOptions, nil
}

// DoGetWithHeaderExtraction performs a normal DoGet, but wraps the stream in a
// mechanism that extracts headers when they become available. At least one
// record should be read from the *flightReader before the headers are
// available.
func (c *client) DoGetWithHeaderExtraction(ctx context.Context, in *flight.Ticket, opts ...grpc.CallOption) (*flightReader, error) {
	stream, err := c.Client.Client.DoGet(ctx, in, opts...)
	if err != nil {
		return nil, err
	}
	return newFlightReader(stream, c.Alloc)
}

// flightReader wraps a [flight.Reader] to expose the headers captured when the
// first read occurs on the stream.
type flightReader struct {
	*flight.Reader
	extractor *headerExtractor
}

// newFlightReader returns a [flightReader].
func newFlightReader(stream flight.FlightService_DoGetClient, alloc memory.Allocator) (*flightReader, error) {
	extractor := &headerExtractor{stream: stream}
	reader, err := flight.NewRecordReader(extractor, ipc.WithAllocator(alloc))
	if err != nil {
		return nil, err
	}
	return &flightReader{
		Reader:    reader,
		extractor: extractor,
	}, nil
}

// Header returns the extracted headers if they exist.
func (s *flightReader) Header() (metadata.MD, error) {
	return s.extractor.Header()
}

// headerExtractor collects the stream's headers on the first call to
// [(*headerExtractor).Recv].
type headerExtractor struct {
	stream flight.FlightService_DoGetClient

	once   sync.Once
	header metadata.MD
	err    error
}

// Header returns the extracted headers if they exist.
func (s *headerExtractor) Header() (metadata.MD, error) {
	return s.header, s.err
}

// Recv reads from the stream. The first invocation will capture the headers.
func (s *headerExtractor) Recv() (*flight.FlightData, error) {
	data, err := s.stream.Recv()
	s.once.Do(func() {
		s.header, s.err = s.stream.Header()
	})
	return data, err
}
