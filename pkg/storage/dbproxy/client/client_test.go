package client_test

import (
	"context"
	"database/sql"
	"errors"
	"net"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/authlib/authn"
	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"github.com/grafana/grafana/pkg/storage/dbproxy/client"
	"github.com/grafana/grafana/pkg/storage/dbproxy/sqldriver"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/resolver"
	"google.golang.org/grpc/resolver/manual"
	"google.golang.org/grpc/status"
)

type exchanger struct {
	requests chan authn.TokenExchangeRequest
	failure  error
}

func (e exchanger) Exchange(_ context.Context, request authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error) {
	e.requests <- request
	if e.failure != nil {
		return nil, e.failure
	}
	return &authn.TokenExchangeResponse{Token: "raw-token"}, nil
}

type server struct {
	dbproxyv1.UnimplementedDatabaseProxyServiceServer
	requests chan metadata.MD
}

func (s *server) Query(_ *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
	md, _ := metadata.FromIncomingContext(stream.Context())
	s.requests <- md
	return stream.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "x", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}})
}
func TestNewConnExchangesWildcardTokenOnStream(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	fixture := &server{requests: make(chan metadata.MD, 1)}
	grpcServer := grpc.NewServer()
	dbproxyv1.RegisterDatabaseProxyServiceServer(grpcServer, fixture)
	go func() { _ = grpcServer.Serve(listener) }()
	t.Cleanup(grpcServer.Stop)
	exchange := exchanger{requests: make(chan authn.TokenExchangeRequest, 1)}
	conn, err := client.NewConn(listener.Addr().String(), insecure.NewCredentials(), exchange)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := conn.Close(); err != nil {
			t.Errorf("close conn: %v", err)
		}
	}()
	connector, err := sqldriver.New(dbproxyv1.NewDatabaseProxyServiceClient(conn)).OpenConnector("")
	if err != nil {
		t.Fatal(err)
	}
	pool := sql.OpenDB(connector)
	defer func() {
		if err := pool.Close(); err != nil {
			t.Errorf("close pool: %v", err)
		}
	}()
	ctx, cancel := context.WithTimeout(sqldriver.WithQuery(context.Background(), "stacks-123", "test.auth"), time.Second)
	defer cancel()
	rows, err := pool.QueryContext(ctx, "SELECT x")
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			t.Errorf("close rows: %v", err)
		}
	}()
	for rows.Next() {
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	request := <-exchange.requests
	if request.Namespace != "*" || len(request.Audiences) != 1 || request.Audiences[0] != "single-tenant-db-proxy" || request.SubjectToken != "" {
		t.Fatalf("exchange request = %+v", request)
	}
	if tokens := (<-fixture.requests).Get("x-access-token"); len(tokens) != 1 || tokens[0] != "raw-token" {
		t.Fatalf("token metadata = %v", tokens)
	}
}
func TestNewConnNeedsExplicitDependenciesAndDefersEndpointFailure(t *testing.T) {
	exchange := exchanger{requests: make(chan authn.TokenExchangeRequest, 1)}
	if _, err := client.NewConn("127.0.0.1:1", nil, exchange); err == nil {
		t.Fatal("nil transport accepted")
	}
	if _, err := client.NewConn("127.0.0.1:1", insecure.NewCredentials(), nil); err == nil {
		t.Fatal("nil exchanger accepted")
	}
	conn, err := client.NewConn("127.0.0.1:1", insecure.NewCredentials(), exchange)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := conn.Close(); err != nil {
			t.Errorf("close conn: %v", err)
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	stream, err := dbproxyv1.NewDatabaseProxyServiceClient(conn).Query(ctx, &dbproxyv1.QueryRequest{})
	if err == nil {
		_, err = stream.Recv()
	}
	if err == nil {
		t.Fatal("unavailable endpoint succeeded")
	}
}
func TestTokenExchangeFailureStopsQuery(t *testing.T) {
	exchange := exchanger{requests: make(chan authn.TokenExchangeRequest, 1), failure: errors.New("exchange unavailable")}
	conn, err := client.NewConn("127.0.0.1:1", insecure.NewCredentials(), exchange)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := conn.Close(); err != nil {
			t.Errorf("close conn: %v", err)
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	_, err = dbproxyv1.NewDatabaseProxyServiceClient(conn).Query(ctx, &dbproxyv1.QueryRequest{})
	if !errors.Is(err, exchange.failure) {
		t.Fatalf("exchange error = %v", err)
	}
}

type retryServer struct {
	dbproxyv1.UnimplementedDatabaseProxyServiceServer
	attempts atomic.Int32
}

func (s *retryServer) Query(*dbproxyv1.QueryRequest, grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
	s.attempts.Add(1)
	return status.Error(codes.Unavailable, "routing unavailable")
}
func TestHandledUnavailableQueryIsNotRetried(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	fixture := &retryServer{}
	grpcServer := grpc.NewServer()
	dbproxyv1.RegisterDatabaseProxyServiceServer(grpcServer, fixture)
	go func() { _ = grpcServer.Serve(listener) }()
	t.Cleanup(grpcServer.Stop)
	policy := `{"methodConfig":[{"name":[{"service":"dbproxy.v1.DatabaseProxyService","method":"Query"}],"retryPolicy":{"MaxAttempts":4,"InitialBackoff":"0.01s","MaxBackoff":"0.01s","BackoffMultiplier":1,"RetryableStatusCodes":["UNAVAILABLE"]}}]}`
	builder := manual.NewBuilderWithScheme("proxy-retry-regression")
	builder.BuildCallback = func(_ resolver.Target, cc resolver.ClientConn, _ resolver.BuildOptions) {
		if err := cc.UpdateState(resolver.State{Addresses: []resolver.Address{{Addr: listener.Addr().String()}}, ServiceConfig: cc.ParseServiceConfig(policy)}); err != nil {
			t.Errorf("resolver state: %v", err)
		}
	}
	resolver.Register(builder)
	exchange := exchanger{requests: make(chan authn.TokenExchangeRequest, 8)}
	conn, err := client.NewConn("proxy-retry-regression:///proxy", insecure.NewCredentials(), exchange)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := conn.Close(); err != nil {
			t.Errorf("close conn: %v", err)
		}
	}()
	connector, err := sqldriver.New(dbproxyv1.NewDatabaseProxyServiceClient(conn)).OpenConnector("")
	if err != nil {
		t.Fatal(err)
	}
	pool := sql.OpenDB(connector)
	defer func() {
		if err := pool.Close(); err != nil {
			t.Errorf("close pool: %v", err)
		}
	}()
	ctx, cancel := context.WithTimeout(sqldriver.WithQuery(context.Background(), "stacks-17", "test.no_replay"), time.Second)
	defer cancel()
	_, err = pool.QueryContext(ctx, "SELECT n")
	if status.Code(err) != codes.Unavailable {
		t.Fatalf("query status = %v", err)
	}
	if attempts := fixture.attempts.Load(); attempts != 1 {
		t.Fatalf("server observed %d attempts after processing query", attempts)
	}
}
