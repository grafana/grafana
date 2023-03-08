package lokigrpc

import (
	"context"
	"crypto/tls"
	"errors"

	grpcretry "github.com/grpc-ecosystem/go-grpc-middleware/retry"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/grafana/grafana/pkg/components/loki/logproto"
)

// Client is a gRPC-based Loki client implementation.
type Client struct {
	client logproto.PusherClient
	conn   *grpc.ClientConn
	opts   []grpc.DialOption
	cfg    Config
}

// NewClient instantiates a new Client.
func NewClient(cfg Config, opts ...grpc.DialOption) (*Client, error) {
	w := &Client{
		opts: opts,
		cfg:  cfg,
	}

	return w, w.init()
}

// Write pushes a new request with the given streams through
// the attached gRPC connection.
func (c *Client) Write(streams []logproto.Stream) (err error) {
	pushRequest := &logproto.PushRequest{
		Streams: streams,
	}

	ctx, cancel := c.timeoutCtx()
	defer cancel()

	if len(c.cfg.TenantID) > 0 {
		ctx = injectOrgID(ctx, c.cfg.TenantID)
	}

	_, err = c.client.Push(ctx, pushRequest)
	return err
}

// Close closes the attached gRPC connection.
func (c *Client) Close() error {
	return c.conn.Close()
}

func (c *Client) init() error {
	if len(c.cfg.URL) == 0 {
		return errors.New("cfg must have Loki url")
	}

	opts := append(c.opts, c.grpcTLSOption(), c.grpcRetryOption())
	conn, err := grpc.Dial(c.cfg.URL, opts...)
	if err != nil {
		return err
	}

	c.conn = conn
	c.client = logproto.NewPusherClient(conn)
	return nil
}

func (c *Client) grpcTLSOption() grpc.DialOption {
	if c.cfg.TLSDisabled {
		return grpc.WithTransportCredentials(insecure.NewCredentials())
	}

	config := &tls.Config{InsecureSkipVerify: false}
	return grpc.WithTransportCredentials(credentials.NewTLS(config))
}

func (c *Client) grpcRetryOption() grpc.DialOption {
	return grpc.WithUnaryInterceptor(
		grpcretry.UnaryClientInterceptor(
			grpcretry.WithMax(c.cfg.Retries),
		),
	)
}

func (c *Client) timeoutCtx() (context.Context, context.CancelFunc) {
	if c.cfg.Timeout > 0 {
		return context.WithTimeout(context.Background(), c.cfg.Timeout)
	}

	return context.WithCancel(context.Background())
}
