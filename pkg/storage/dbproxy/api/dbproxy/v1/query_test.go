package dbproxyv1_test

import (
	"context"
	"errors"
	"io"
	"math"
	"net"
	"strings"
	"testing"
	"time"

	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestQueryTransportTypedValues(t *testing.T) {
	fixtures := []struct {
		column *dbproxyv1.Column
		value  *dbproxyv1.Value
	}{
		{
			column: &dbproxyv1.Column{Name: "null", ValueType: dbproxyv1.ValueType_VALUE_TYPE_NULL},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_NullValue{NullValue: structpb.NullValue_NULL_VALUE}},
		},
		{
			column: &dbproxyv1.Column{Name: "zero", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64, Nullable: proto.Bool(false)},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_Int64Value{Int64Value: 0}},
		},
		{
			column: &dbproxyv1.Column{Name: "min_int64", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_Int64Value{Int64Value: math.MinInt64}},
		},
		{
			column: &dbproxyv1.Column{Name: "max_uint64", ValueType: dbproxyv1.ValueType_VALUE_TYPE_UINT64},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_Uint64Value{Uint64Value: math.MaxUint64}},
		},
		{
			column: &dbproxyv1.Column{Name: "float", ValueType: dbproxyv1.ValueType_VALUE_TYPE_FLOAT64},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_Float64Value{Float64Value: 1.25}},
		},
		{
			column: &dbproxyv1.Column{Name: "false", ValueType: dbproxyv1.ValueType_VALUE_TYPE_BOOL},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_BoolValue{BoolValue: false}},
		},
		{
			column: &dbproxyv1.Column{Name: "empty_string", ValueType: dbproxyv1.ValueType_VALUE_TYPE_STRING},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_StringValue{StringValue: ""}},
		},
		{
			column: &dbproxyv1.Column{Name: "empty_bytes", ValueType: dbproxyv1.ValueType_VALUE_TYPE_BYTES, Length: proto.Int64(0)},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_BytesValue{BytesValue: []byte{}}},
		},
		{
			column: &dbproxyv1.Column{Name: "binary", ValueType: dbproxyv1.ValueType_VALUE_TYPE_BYTES},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_BytesValue{BytesValue: []byte{0, 0xff, 0x80}}},
		},
		{
			column: &dbproxyv1.Column{Name: "timestamp", ValueType: dbproxyv1.ValueType_VALUE_TYPE_TIMESTAMP},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_TimestampValue{TimestampValue: timestamppb.New(time.Date(2026, 10, 7, 12, 34, 56, 123456789, time.UTC))}},
		},
		{
			column: &dbproxyv1.Column{Name: "zero_date", ValueType: dbproxyv1.ValueType_VALUE_TYPE_TIMESTAMP},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_TimestampValue{TimestampValue: timestamppb.New(time.Time{})}},
		},
		{
			column: &dbproxyv1.Column{Name: "decimal", ValueType: dbproxyv1.ValueType_VALUE_TYPE_BYTES, DatabaseTypeName: "DECIMAL", DecimalSize: &dbproxyv1.DecimalSize{Precision: 40, Scale: 20}},
			value:  &dbproxyv1.Value{Kind: &dbproxyv1.Value_BytesValue{BytesValue: []byte("18446744073709551615.12345678901234567890")}},
		},
	}
	columns := make([]*dbproxyv1.Column, len(fixtures))
	values := make([]*dbproxyv1.Value, len(fixtures))
	for i, fixture := range fixtures {
		columns[i], values[i] = fixture.column, fixture.value
	}
	wantResponses := []*dbproxyv1.QueryResponse{
		{Columns: columns},
		{Warnings: []*dbproxyv1.Warning{{Code: "notice", Message: "query notice"}}},
		{
			Rows:     []*dbproxyv1.Row{{Values: values}},
			Warnings: []*dbproxyv1.Warning{{Code: "1265", Message: "value truncated"}},
		},
		{Warnings: []*dbproxyv1.Warning{{Code: "1264", Message: "value out of range"}}},
	}
	wantRequest := &dbproxyv1.QueryRequest{
		Namespace: "stacks-123", QueryName: "contract.values",
		Sql: "SELECT " + strings.Repeat("?, ", len(values)-1) + "?", Parameters: values,
	}
	requests := make(chan *dbproxyv1.QueryRequest, 1)
	client := newClient(t, func(req *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		requests <- req
		return sendResponses(stream, wantResponses)
	})
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	stream, err := client.Query(ctx, wantRequest)
	if err != nil {
		t.Fatal(err)
	}
	checkResponses(t, stream, wantResponses)
	if got, err := stream.Recv(); !errors.Is(err, io.EOF) {
		t.Fatalf("stream completion: got %v, error %v; want EOF", got, err)
	}
	if got := <-requests; !proto.Equal(got, wantRequest) {
		t.Fatalf("request changed during transport: got %v, want %v", got, wantRequest)
	}
}

func TestQueryTransportErrorAfterRows(t *testing.T) {
	wantResponses := []*dbproxyv1.QueryResponse{
		{Columns: []*dbproxyv1.Column{{Name: "count", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}},
		{Rows: []*dbproxyv1.Row{{Values: []*dbproxyv1.Value{{Kind: &dbproxyv1.Value_Int64Value{Int64Value: 1}}}}}},
	}
	wantDetail := &dbproxyv1.QueryError{
		Reason:        dbproxyv1.ErrorReason_ERROR_REASON_SQL_ERROR,
		DatabaseError: &dbproxyv1.DatabaseError{Code: "1105", SqlState: "HY000"},
	}
	failure, err := status.New(codes.FailedPrecondition, "query failed").WithDetails(wantDetail)
	if err != nil {
		t.Fatal(err)
	}
	client := newClient(t, func(_ *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		if err := sendResponses(stream, wantResponses); err != nil {
			return err
		}
		return failure.Err()
	})
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	stream, err := client.Query(ctx, &dbproxyv1.QueryRequest{Namespace: "stacks-123", QueryName: "contract.error", Sql: "SELECT count FROM counters"})
	if err != nil {
		t.Fatal(err)
	}
	checkResponses(t, stream, wantResponses)
	_, err = stream.Recv()
	if err == nil || errors.Is(err, io.EOF) {
		t.Fatalf("query failure was reported as successful completion: %v", err)
	}
	gotStatus := status.Convert(err)
	if gotStatus.Code() != failure.Code() || gotStatus.Message() != failure.Message() {
		t.Fatalf("status = %v, want %v", gotStatus, failure)
	}
	details := gotStatus.Details()
	if len(details) != 1 {
		t.Fatalf("status details = %v, want one QueryError", details)
	}
	gotDetail, ok := details[0].(*dbproxyv1.QueryError)
	if !ok || !proto.Equal(gotDetail, wantDetail) {
		t.Fatalf("error detail = %v, want %v", details[0], wantDetail)
	}
}

type queryServer struct {
	dbproxyv1.UnimplementedDatabaseProxyServiceServer
	query func(*dbproxyv1.QueryRequest, grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error
}

func (s *queryServer) Query(req *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
	return s.query(req, stream)
}

func newClient(t *testing.T, query func(*dbproxyv1.QueryRequest, grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error) dbproxyv1.DatabaseProxyServiceClient {
	t.Helper()
	listener := bufconn.Listen(1024 * 1024)
	server := grpc.NewServer()
	dbproxyv1.RegisterDatabaseProxyServiceServer(server, &queryServer{query: query})
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(func() {
		server.Stop()
		_ = listener.Close()
	})
	conn, err := grpc.NewClient("passthrough:///contract-test",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return listener.DialContext(ctx)
		}),
	)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return dbproxyv1.NewDatabaseProxyServiceClient(conn)
}

func sendResponses(stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse], responses []*dbproxyv1.QueryResponse) error {
	for _, response := range responses {
		if err := stream.Send(response); err != nil {
			return err
		}
	}
	return nil
}

func checkResponses(t *testing.T, stream grpc.ServerStreamingClient[dbproxyv1.QueryResponse], want []*dbproxyv1.QueryResponse) {
	t.Helper()
	for i, response := range want {
		got, err := stream.Recv()
		if err != nil || !proto.Equal(got, response) {
			t.Fatalf("response %d: got %v, error %v; want %v", i, got, err, response)
		}
	}
}
