package sqldriver_test

import (
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"net"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"github.com/grafana/grafana/pkg/storage/dbproxy/sqldriver"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type queryServer struct {
	dbproxyv1.UnimplementedDatabaseProxyServiceServer
	query func(*dbproxyv1.QueryRequest, grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error
}

func (s *queryServer) Query(req *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
	return s.query(req, stream)
}
func openPool(t *testing.T, query func(*dbproxyv1.QueryRequest, grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error) *sql.DB {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	server := grpc.NewServer()
	dbproxyv1.RegisterDatabaseProxyServiceServer(server, &queryServer{query: query})
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	connector, err := sqldriver.New(dbproxyv1.NewDatabaseProxyServiceClient(conn)).OpenConnector("")
	if err != nil {
		t.Fatal(err)
	}
	pool := sql.OpenDB(connector)
	t.Cleanup(func() { _ = pool.Close() })
	return pool
}
func TestPreparedQueryUsesExecutionIdentityAndParameters(t *testing.T) {
	seen := make(chan *dbproxyv1.QueryRequest, 1)
	pool := openPool(t, func(req *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		seen <- req
		if err := stream.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "answer", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}}); err != nil {
			return err
		}
		return stream.Send(&dbproxyv1.QueryResponse{Rows: []*dbproxyv1.Row{{Values: []*dbproxyv1.Value{{Kind: &dbproxyv1.Value_Int64Value{Int64Value: 42}}}}}})
	})
	stmt, err := pool.PrepareContext(sqldriver.WithQuery(context.Background(), "stacks-1", "prepare.only"), "SELECT ?")
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := stmt.Close(); err != nil {
			t.Errorf("close stmt: %v", err)
		}
	}()
	ctx, cancel := context.WithTimeout(sqldriver.WithQuery(context.Background(), "stacks-123", "test.answer"), time.Second)
	defer cancel()
	var got int64
	if err := stmt.QueryRowContext(ctx, int64(7)).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != 42 {
		t.Fatalf("answer = %d", got)
	}
	req := <-seen
	if req.Namespace != "stacks-123" || req.QueryName != "test.answer" || req.Sql != "SELECT ?" || len(req.Parameters) != 1 || req.Parameters[0].GetInt64Value() != 7 {
		t.Fatalf("request = %v", req)
	}
}

func TestRowsPreserveMetadataAndValues(t *testing.T) {
	nullable, length := true, int64(0)
	stamp := time.Date(2024, 1, 2, 3, 4, 5, 123456789, time.FixedZone("offset", 3600))
	pool := openPool(t, func(_ *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		columns := []*dbproxyv1.Column{
			{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_UINT64, DatabaseTypeName: "BIGINT", Nullable: &nullable},
			{Name: "d", ValueType: dbproxyv1.ValueType_VALUE_TYPE_BYTES, DatabaseTypeName: "DECIMAL", DecimalSize: &dbproxyv1.DecimalSize{Precision: 30, Scale: 12}},
			{Name: "b", ValueType: dbproxyv1.ValueType_VALUE_TYPE_BYTES, Length: &length},
			{Name: "updated", ValueType: dbproxyv1.ValueType_VALUE_TYPE_TIMESTAMP},
		}
		schema := &dbproxyv1.QueryResponse{Columns: columns}
		schema.ProtoReflect().SetUnknown(protowire.AppendVarint(protowire.AppendTag(nil, 100, protowire.VarintType), 7))
		if err := stream.Send(schema); err != nil {
			return err
		}
		if err := stream.Send(&dbproxyv1.QueryResponse{Warnings: []*dbproxyv1.Warning{{Code: "1"}}}); err != nil {
			return err
		}
		return stream.Send(&dbproxyv1.QueryResponse{Rows: []*dbproxyv1.Row{{Values: []*dbproxyv1.Value{
			{Kind: &dbproxyv1.Value_Uint64Value{Uint64Value: ^uint64(0)}},
			{Kind: &dbproxyv1.Value_BytesValue{BytesValue: []byte("123456789012345678.123456789012")}},
			{Kind: &dbproxyv1.Value_BytesValue{BytesValue: []byte{}}},
			{Kind: &dbproxyv1.Value_TimestampValue{TimestampValue: timestamppb.New(stamp)}},
		}}, {Values: []*dbproxyv1.Value{
			{Kind: &dbproxyv1.Value_NullValue{NullValue: structpb.NullValue_NULL_VALUE}},
			{Kind: &dbproxyv1.Value_BytesValue{BytesValue: []byte("0.000000000001")}},
			{Kind: &dbproxyv1.Value_BytesValue{BytesValue: []byte{0, 255}}},
			{Kind: &dbproxyv1.Value_TimestampValue{TimestampValue: timestamppb.New(time.Time{})}},
		}}}, Warnings: []*dbproxyv1.Warning{{Code: "2"}}})
	})
	rows, err := pool.QueryContext(sqldriver.WithQuery(context.Background(), "stacks-2", "test.values"), "SELECT values")
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			t.Errorf("close rows: %v", err)
		}
	}()
	assertColumnTypes(t, rows)
	var n, d, b, updated any
	if !rows.Next() {
		t.Fatalf("first row: %v", rows.Err())
	}
	if err := rows.Scan(&n, &d, &b, &updated); err != nil {
		t.Fatal(err)
	}
	emptyBytes, ok := b.([]byte)
	if !ok || emptyBytes == nil || len(emptyBytes) != 0 {
		t.Fatalf("empty bytes = %#v", b)
	}
	if string(n.([]byte)) != "18446744073709551615" || string(d.([]byte)) != "123456789012345678.123456789012" || !updated.(time.Time).Equal(stamp) {
		t.Fatalf("first row = %v %v %v %v", n, d, b, updated)
	}
	if !rows.Next() {
		t.Fatalf("second row: %v", rows.Err())
	}
	if err := rows.Scan(&n, &d, &b, &updated); err != nil {
		t.Fatal(err)
	}
	if n != nil || string(d.([]byte)) != "0.000000000001" || !bytes.Equal(b.([]byte), []byte{0, 255}) || !updated.(time.Time).IsZero() {
		t.Fatalf("second row = %v %v %v %v", n, d, b, updated)
	}
	if rows.Next() || rows.Err() != nil {
		t.Fatalf("completion: %v", rows.Err())
	}
}

func assertColumnTypes(t *testing.T, rows *sql.Rows) {
	t.Helper()
	types, err := rows.ColumnTypes()
	if err != nil {
		t.Fatal(err)
	}
	if types[0].ScanType() != reflect.TypeFor[[]byte]() || types[3].ScanType() != reflect.TypeFor[time.Time]() {
		t.Fatalf("scan types = %v, %v", types[0].ScanType(), types[3].ScanType())
	}
	if types[0].DatabaseTypeName() != "BIGINT" {
		t.Fatalf("type = %s", types[0].DatabaseTypeName())
	}
	if n, ok := types[0].Nullable(); !ok || !n {
		t.Fatal("nullable metadata lost")
	}
	if _, ok := types[1].Nullable(); ok {
		t.Fatal("unknown nullability became known")
	}
	if p, s, ok := types[1].DecimalSize(); !ok || p != 30 || s != 12 {
		t.Fatalf("decimal metadata = %d,%d,%v", p, s, ok)
	}
	if l, ok := types[2].Length(); !ok || l != 0 {
		t.Fatalf("length = %d,%v", l, ok)
	}
	if _, ok := types[3].Length(); ok {
		t.Fatal("unknown length became known")
	}
}

func TestLateStatusIsReportedWithoutReplay(t *testing.T) {
	var attempts atomic.Int32
	failure := status.New(codes.FailedPrecondition, "query failed")
	withDetail, err := failure.WithDetails(&dbproxyv1.QueryError{Reason: dbproxyv1.ErrorReason(99)})
	if err != nil {
		t.Fatal(err)
	}
	pool := openPool(t, func(_ *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		attempts.Add(1)
		if err := stream.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}}); err != nil {
			return err
		}
		if err := stream.Send(&dbproxyv1.QueryResponse{Rows: []*dbproxyv1.Row{{Values: []*dbproxyv1.Value{{Kind: &dbproxyv1.Value_Int64Value{Int64Value: 1}}}}}}); err != nil {
			return err
		}
		return withDetail.Err()
	})
	rows, err := pool.QueryContext(sqldriver.WithQuery(context.Background(), "stacks-4", "test.late"), "SELECT n")
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			t.Errorf("close rows: %v", err)
		}
	}()
	if !rows.Next() {
		t.Fatal(rows.Err())
	}
	var n int64
	if err := rows.Scan(&n); err != nil {
		t.Fatal(err)
	}
	if rows.Next() {
		t.Fatal("unexpected extra row")
	}
	if status.Code(rows.Err()) != codes.FailedPrecondition {
		t.Fatalf("late error: %v", rows.Err())
	}
	st, _ := status.FromError(rows.Err())
	if len(st.Details()) != 1 {
		t.Fatalf("details: %v", st.Details())
	}
	if detail, ok := st.Details()[0].(*dbproxyv1.QueryError); !ok || detail.Reason != dbproxyv1.ErrorReason(99) {
		t.Fatalf("unknown reason lost: %v", st.Details())
	}
	if attempts.Load() != 1 {
		t.Fatalf("attempts: %d", attempts.Load())
	}
}

func TestMalformedStreamFails(t *testing.T) {
	cases := map[string]func(grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error{
		"missing schema": func(grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error { return nil },
		"rows before schema": func(s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
			return s.Send(&dbproxyv1.QueryResponse{Rows: []*dbproxyv1.Row{{}}})
		},
		"unknown kind": func(s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
			return s.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{ValueType: dbproxyv1.ValueType(99)}}})
		},
		"wrong row width": func(s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
			if err := s.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}}); err != nil {
				return err
			}
			return s.Send(&dbproxyv1.QueryResponse{Rows: []*dbproxyv1.Row{{}}})
		},
		"repeated schema": func(s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
			schema := &dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}}
			if err := s.Send(schema); err != nil {
				return err
			}
			return s.Send(schema)
		},
		"negative length": func(s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
			length := int64(-1)
			return s.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{ValueType: dbproxyv1.ValueType_VALUE_TYPE_STRING, Length: &length}}})
		},
		"scale exceeds precision": func(s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
			return s.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{ValueType: dbproxyv1.ValueType_VALUE_TYPE_BYTES, DecimalSize: &dbproxyv1.DecimalSize{Precision: 2, Scale: 3}}}})
		},
		"nonnullable NULL": func(s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
			no := false
			if err := s.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64, Nullable: &no}}}); err != nil {
				return err
			}
			return s.Send(&dbproxyv1.QueryResponse{Rows: []*dbproxyv1.Row{{Values: []*dbproxyv1.Value{{Kind: &dbproxyv1.Value_NullValue{NullValue: structpb.NullValue_NULL_VALUE}}}}}})
		},
		"invalid timestamp": func(s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
			if err := s.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{ValueType: dbproxyv1.ValueType_VALUE_TYPE_TIMESTAMP}}}); err != nil {
				return err
			}
			return s.Send(&dbproxyv1.QueryResponse{Rows: []*dbproxyv1.Row{{Values: []*dbproxyv1.Value{{Kind: &dbproxyv1.Value_TimestampValue{TimestampValue: &timestamppb.Timestamp{Seconds: 253402300800}}}}}}})
		},
		"missing value kind": func(s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
			if err := s.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}}); err != nil {
				return err
			}
			return s.Send(&dbproxyv1.QueryResponse{Rows: []*dbproxyv1.Row{{Values: []*dbproxyv1.Value{{}}}}})
		},
		"mismatched kind": func(s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
			if err := s.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}}); err != nil {
				return err
			}
			return s.Send(&dbproxyv1.QueryResponse{Rows: []*dbproxyv1.Row{{Values: []*dbproxyv1.Value{{Kind: &dbproxyv1.Value_StringValue{StringValue: "x"}}}}}})
		},
	}
	for name, send := range cases {
		t.Run(name, func(t *testing.T) {
			pool := openPool(t, func(_ *dbproxyv1.QueryRequest, s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
				return send(s)
			})
			rows, err := pool.QueryContext(sqldriver.WithQuery(context.Background(), "stacks-5", "test.malformed"), "SELECT n")
			if err != nil {
				return
			}
			defer func() {
				if err := rows.Close(); err != nil {
					t.Errorf("close rows: %v", err)
				}
			}()
			for rows.Next() {
			}
			if rows.Err() == nil {
				t.Fatal("malformed stream accepted")
			}
		})
	}
}

func TestMissingIdentityAndWritesFailLocally(t *testing.T) {
	var attempts atomic.Int32
	pool := openPool(t, func(*dbproxyv1.QueryRequest, grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		attempts.Add(1)
		return nil
	})
	for _, ctx := range []context.Context{context.Background(), sqldriver.WithQuery(context.Background(), "stacks-0", "test.bad"),
		sqldriver.WithQuery(context.Background(), "stacks-999999999999999999999", "test.bad"), sqldriver.WithQuery(context.Background(), "stacks-1", "Bad.Name")} {
		if _, err := pool.QueryContext(ctx, "SELECT 1"); err == nil {
			t.Fatal("invalid identity accepted")
		}
	}
	if _, err := pool.ExecContext(context.Background(), "DELETE FROM t"); !errors.Is(err, sqldriver.ErrUnsupported) {
		t.Fatalf("exec = %v", err)
	}
	if _, err := pool.BeginTx(context.Background(), nil); !errors.Is(err, sqldriver.ErrUnsupported) {
		t.Fatalf("begin = %v", err)
	}
	if err := pool.PingContext(context.Background()); !errors.Is(err, sqldriver.ErrUnsupported) {
		t.Fatalf("ping = %v", err)
	}
	if attempts.Load() != 0 {
		t.Fatalf("unexpected RPCs: %d", attempts.Load())
	}
}

func TestClosingRowsCancelsStream(t *testing.T) {
	cancelled := make(chan struct{})
	pool := openPool(t, func(_ *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		if err := stream.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}}); err != nil {
			return err
		}
		<-stream.Context().Done()
		close(cancelled)
		return stream.Context().Err()
	})
	rows, err := pool.QueryContext(sqldriver.WithQuery(context.Background(), "stacks-8", "test.cancel"), "SELECT n")
	if err != nil {
		t.Fatal(err)
	}
	if err := rows.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-cancelled:
	case <-time.After(time.Second):
		t.Fatal("server did not observe cancellation")
	}
}

func TestConcurrentContextsRemainIndependent(t *testing.T) {
	seen := make(chan string, 20)
	pool := openPool(t, func(req *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		seen <- req.Namespace + "/" + req.QueryName
		return stream.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}})
	})
	var group sync.WaitGroup
	for i := 1; i <= 20; i++ {
		group.Add(1)
		go func(i int) {
			defer group.Done()
			ctx := sqldriver.WithQuery(context.Background(), fmt.Sprintf("stacks-%d", i), fmt.Sprintf("test.concurrent.%d", i))
			rows, err := pool.QueryContext(ctx, "SELECT wait")
			if err != nil {
				t.Error(err)
				return
			}
			defer func() {
				if err := rows.Close(); err != nil {
					t.Errorf("close rows: %v", err)
				}
			}()
			for rows.Next() {
			}
			if err := rows.Err(); err != nil {
				t.Error(err)
			}
		}(i)
	}
	group.Wait()
	close(seen)
	found := map[string]bool{}
	for identity := range seen {
		found[identity] = true
	}
	for i := 1; i <= 20; i++ {
		identity := fmt.Sprintf("stacks-%d/test.concurrent.%d", i, i)
		if !found[identity] {
			t.Fatalf("missing %s", identity)
		}
	}
}

func TestAllInputKindsAndValuer(t *testing.T) {
	seen := make(chan []*dbproxyv1.Value, 1)
	pool := openPool(t, func(req *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		seen <- req.Parameters
		return stream.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}})
	})
	stamp := time.Date(2024, 6, 1, 12, 13, 14, 15, time.UTC)
	rows, err := pool.QueryContext(sqldriver.WithQuery(context.Background(), "stacks-9", "test.parameters"), "SELECT ?", nil, int64(-7), ^uint64(0), 1.5, true, "text", []byte{}, stamp, valuedString("converted"))
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
	params := <-seen
	if len(params) != 9 || params[0].GetKind() == nil || params[1].GetInt64Value() != -7 || params[2].GetUint64Value() != ^uint64(0) || params[3].GetFloat64Value() != 1.5 || !params[4].GetBoolValue() || params[5].GetStringValue() != "text" || params[6].GetKind() == nil || !params[7].GetTimestampValue().AsTime().Equal(stamp) || params[8].GetStringValue() != "converted" {
		t.Fatalf("parameters = %v", params)
	}
	if _, ok := params[6].GetKind().(*dbproxyv1.Value_BytesValue); !ok {
		t.Fatal("empty bytes became NULL")
	}
}

type valuedString string

func (v valuedString) Value() (driver.Value, error) { return string(v), nil }

func TestQueryNameCanBeReplacedWithoutLosingStack(t *testing.T) {
	seen := make(chan string, 1)
	pool := openPool(t, func(req *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		seen <- req.Namespace + "/" + req.QueryName
		return stream.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}})
	})
	ctx := sqldriver.WithQuery(context.Background(), "stacks-10", "test.old")
	if sqldriver.QueryName(ctx) != "test.old" {
		t.Fatalf("initial query name = %q", sqldriver.QueryName(ctx))
	}
	ctx = sqldriver.WithQueryName(ctx, "test.new")
	rows, err := pool.QueryContext(ctx, "SELECT wait")
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			t.Errorf("close rows: %v", err)
		}
	}()
	if got := <-seen; got != "stacks-10/test.new" {
		t.Fatalf("identity = %s", got)
	}
}

func TestFailureBeforeSchemaPreservesStatus(t *testing.T) {
	failure := status.Error(codes.Unavailable, "routing unavailable")
	pool := openPool(t, func(*dbproxyv1.QueryRequest, grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		return failure
	})
	_, err := pool.QueryContext(sqldriver.WithQuery(context.Background(), "stacks-11", "test.failed"), "SELECT n")
	if status.Code(err) != codes.Unavailable {
		t.Fatalf("status = %v", err)
	}
	st, _ := status.FromError(err)
	if len(st.Details()) != 0 {
		t.Fatalf("unexpected details = %v", st.Details())
	}
}

func TestCallerCancellationStopsQueryBeforeSchema(t *testing.T) {
	entered := make(chan struct{})
	cancelled := make(chan struct{})
	pool := openPool(t, func(req *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		if req.Sql == "SELECT n" {
			return stream.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}})
		}
		close(entered)
		<-stream.Context().Done()
		close(cancelled)
		return stream.Context().Err()
	})
	ctx, cancel := context.WithCancel(sqldriver.WithQuery(context.Background(), "stacks-12", "test.cancelled"))
	finished := make(chan error, 1)
	go func() {
		rows, err := pool.QueryContext(ctx, "SELECT wait")
		if rows != nil {
			_ = rows.Close()
		}
		finished <- err
	}()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("server did not start")
	}
	cancel()
	select {
	case err := <-finished:
		if !errors.Is(err, context.Canceled) && status.Code(err) != codes.Canceled {
			t.Fatalf("cancel error = %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("query did not cancel")
	}
	select {
	case <-cancelled:
	case <-time.After(time.Second):
		t.Fatal("server did not observe cancellation")
	}
	rows, err := pool.QueryContext(sqldriver.WithQuery(context.Background(), "stacks-12", "test.survives"), "SELECT n")
	if err != nil {
		t.Fatalf("shared transport unusable: %v", err)
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
}
