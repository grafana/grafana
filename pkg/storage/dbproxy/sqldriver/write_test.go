package sqldriver_test

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"github.com/grafana/grafana/pkg/storage/dbproxy/sqldriver"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

func TestStandaloneExecReturnsResultAndExecutionIdentity(t *testing.T) {
	var got *dbproxyv1.ExecRequest
	pool := openServerPool(t, &queryServer{exec: func(_ context.Context, req *dbproxyv1.ExecRequest) (*dbproxyv1.ExecResponse, error) {
		got = req
		return &dbproxyv1.ExecResponse{RowsAffected: 3, LastInsertId: 17}, nil
	}})
	stmt, err := pool.PrepareContext(sqldriver.WithQuery(context.Background(), "stacks-1", "prepare.old"), "INSERT INTO things VALUES (?)")
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := stmt.Close(); err != nil {
			t.Errorf("close statement: %v", err)
		}
	}()
	result, err := stmt.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-2", "write.things"), int64(9))
	if err != nil {
		t.Fatal(err)
	}
	assertResult(t, result, 3, 17)
	if got.GetNamespace() != "stacks-2" || got.GetQueryName() != "write.things" || got.GetSql() != "INSERT INTO things VALUES (?)" || got.GetParameters()[0].GetInt64Value() != 9 {
		t.Fatalf("request = %v", got)
	}
}

func assertResult(t *testing.T, result sql.Result, affected, id int64) {
	t.Helper()
	rows, err := result.RowsAffected()
	if err != nil || rows != affected {
		t.Fatalf("RowsAffected = %d, %v", rows, err)
	}
	last, err := result.LastInsertId()
	if err != nil || last != id {
		t.Fatalf("LastInsertId = %d, %v", last, err)
	}
}

func TestTransactionKeepsNamespaceAndCompletesQueriesBeforeCommit(t *testing.T) {
	observed := make(chan string, 4)
	pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		for {
			request, err := s.Recv()
			if errors.Is(err, io.EOF) {
				return nil
			}
			if err != nil {
				return err
			}
			switch c := request.Command.(type) {
			case *dbproxyv1.TransactionRequest_Begin:
				observed <- c.Begin.Namespace
				if c.Begin.ReadOnly {
					return status.Error(codes.InvalidArgument, "unexpected read only")
				}
				if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}); err != nil {
					return err
				}
			case *dbproxyv1.TransactionRequest_Query:
				observed <- c.Query.QueryName
				if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}}}}); err != nil {
					return err
				}
				if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{Rows: []*dbproxyv1.Row{{Values: []*dbproxyv1.Value{{Kind: &dbproxyv1.Value_Int64Value{Int64Value: 42}}}}}}}}); err != nil {
					return err
				}
				if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}); err != nil {
					return err
				}
			case *dbproxyv1.TransactionRequest_Exec:
				observed <- c.Exec.QueryName
				if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Exec{Exec: &dbproxyv1.ExecResponse{RowsAffected: 2, LastInsertId: 8}}}); err != nil {
					return err
				}
			case *dbproxyv1.TransactionRequest_Commit:
				observed <- "commit"
				return s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}})
			default:
				return status.Error(codes.InvalidArgument, "unexpected command")
			}
		}
	}})
	tx, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-4", "unused.begin"), nil)
	if err != nil {
		t.Fatal(err)
	}
	rows, err := tx.QueryContext(sqldriver.WithQuery(context.Background(), "stacks-4", "read.one"), "SELECT n")
	if err != nil {
		t.Fatal(err)
	}
	if !rows.Next() {
		t.Fatalf("next: %v", rows.Err())
	}
	var n int64
	if err := rows.Scan(&n); err != nil || n != 42 {
		t.Fatalf("row=%d, %v", n, err)
	}
	if _, err := tx.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-4", "write.too.early"), "UPDATE t SET n=2"); err == nil {
		t.Fatal("overlapping command succeeded")
	}
	if _, err := tx.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-5", "write.wrong.stack"), "UPDATE t SET n=2"); err == nil {
		t.Fatal("cross-stack command succeeded")
	}
	if err := rows.Close(); err != nil {
		t.Fatal(err)
	}
	result, err := tx.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-4", "write.one"), "UPDATE t SET n=2")
	if err != nil {
		t.Fatal(err)
	}
	assertResult(t, result, 2, 8)
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"stacks-4", "read.one", "write.one", "commit"} {
		if got := <-observed; got != want {
			t.Fatalf("command=%q, want %q", got, want)
		}
	}
}

func TestRecoverableTransactionErrorPreservesDatabaseDetail(t *testing.T) {
	pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		for {
			request, err := s.Recv()
			if err != nil {
				return err
			}
			switch request.Command.(type) {
			case *dbproxyv1.TransactionRequest_Begin:
				if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}); err != nil {
					return err
				}
			case *dbproxyv1.TransactionRequest_Exec:
				statement := request.GetExec()
				if statement.Sql == "ROLLBACK TO SAVEPOINT sp" {
					if statement.QueryName != "savepoint.recover" {
						return status.Error(codes.InvalidArgument, "wrong query name")
					}
					if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Exec{Exec: &dbproxyv1.ExecResponse{}}}); err != nil {
						return err
					}
				} else if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Error{Error: &dbproxyv1.TransactionCommandError{Message: "duplicate key", DatabaseError: &dbproxyv1.DatabaseError{Code: "1062", SqlState: "23000"}}}}); err != nil {
					return err
				}
			case *dbproxyv1.TransactionRequest_Rollback:
				return s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}})
			default:
				return status.Error(codes.InvalidArgument, "unexpected")
			}
		}
	}})
	tx, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-1", "begin"), nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-1", "write.duplicate"), "INSERT INTO t VALUES (1)")
	if status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("status=%v", err)
	}
	st, _ := status.FromError(err)
	detail, ok := st.Details()[0].(*dbproxyv1.QueryError)
	if !ok || detail.Reason != dbproxyv1.ErrorReason_ERROR_REASON_SQL_ERROR || detail.DatabaseError.Code != "1062" || detail.DatabaseError.SqlState != "23000" {
		t.Fatalf("detail=%v", st.Details())
	}
	if _, err := tx.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-1", "savepoint.recover"), "ROLLBACK TO SAVEPOINT sp"); err != nil {
		t.Fatal(err)
	}
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}
}

func TestLostStandaloneExecReplyHasUnknownOutcome(t *testing.T) {
	calls := 0
	pool := openServerPool(t, &queryServer{exec: func(context.Context, *dbproxyv1.ExecRequest) (*dbproxyv1.ExecResponse, error) {
		calls++
		return nil, status.Error(codes.Unavailable, "connection lost")
	}})
	_, err := pool.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-1", "write.uncertain"), "INSERT INTO t VALUES (1)")
	if !errors.Is(err, sqldriver.ErrOutcomeUnknown) || status.Code(err) != codes.Unavailable {
		t.Fatalf("error=%v", err)
	}
	if calls != 1 {
		t.Fatalf("write replayed %d times", calls)
	}
}

type lostExecReplyClient struct {
	dbproxyv1.DatabaseProxyServiceClient
}

func (c lostExecReplyClient) Exec(ctx context.Context, req *dbproxyv1.ExecRequest, opts ...grpc.CallOption) (*dbproxyv1.ExecResponse, error) {
	if _, err := c.DatabaseProxyServiceClient.Exec(ctx, req, opts...); err != nil {
		return nil, err
	}
	return nil, fmt.Errorf("lost write reply: %w", driver.ErrBadConn)
}

func TestStandaloneExecDoesNotRetryDispatchedBadConn(t *testing.T) {
	var calls atomic.Int32
	pool := openServerPoolWithClient(t, &queryServer{exec: func(context.Context, *dbproxyv1.ExecRequest) (*dbproxyv1.ExecResponse, error) {
		calls.Add(1)
		return &dbproxyv1.ExecResponse{RowsAffected: 1}, nil
	}}, func(client dbproxyv1.DatabaseProxyServiceClient) dbproxyv1.DatabaseProxyServiceClient {
		return lostExecReplyClient{DatabaseProxyServiceClient: client}
	})
	ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "write.reply_lost")
	_, err := pool.ExecContext(ctx, "UPDATE t SET n=1")
	if got := calls.Load(); got != 1 {
		t.Errorf("server executions = %d, want 1", got)
	}
	if !errors.Is(err, sqldriver.ErrOutcomeUnknown) || errors.Is(err, driver.ErrBadConn) || !strings.Contains(err.Error(), "lost write reply") {
		t.Errorf("exec error = %v, want unknown outcome without retry sentinel", err)
	}
}

func TestTransactionCloseDiscoversErrorAndBlocksLaterWrites(t *testing.T) {
	commands := make(chan string, 4)
	pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		for {
			req, err := s.Recv()
			if err != nil {
				return err
			}
			switch req.Command.(type) {
			case *dbproxyv1.TransactionRequest_Begin:
				commands <- "begin"
				if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}); err != nil {
					return err
				}
			case *dbproxyv1.TransactionRequest_Query:
				commands <- "query"
				if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}}}}); err != nil {
					return err
				}
				if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{Rows: []*dbproxyv1.Row{{Values: []*dbproxyv1.Value{{Kind: &dbproxyv1.Value_Int64Value{Int64Value: 1}}}}}}}}); err != nil {
					return err
				}
				return s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Error{Error: &dbproxyv1.TransactionCommandError{Message: "late failure"}}})
			default:
				commands <- "unexpected"
				return nil
			}
		}
	}})
	tx, err := pool.BeginTx(sqldriver.WithQuery(t.Context(), "stacks-1", "begin"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback() }()
	rows, err := tx.QueryContext(sqldriver.WithQuery(t.Context(), "stacks-1", "read.partial"), "SELECT n")
	if err != nil {
		t.Fatal(err)
	}
	if !rows.Next() {
		t.Fatal(rows.Err())
	}
	if err := rows.Close(); err == nil || status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("close error=%v", err)
	}
	if _, err := tx.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-1", "write.after"), "DELETE FROM t"); err == nil {
		t.Fatal("write after abort succeeded")
	}
	if got := <-commands; got != "begin" {
		t.Fatalf("first=%s", got)
	}
	if got := <-commands; got != "query" {
		t.Fatalf("second=%s", got)
	}
	select {
	case got := <-commands:
		t.Fatalf("unexpected server command %s", got)
	default:
	}
}

func TestCommitLostReplyHasUnknownOutcome(t *testing.T) {
	pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		req, err := s.Recv()
		if err != nil {
			return err
		}
		if req.GetBegin() == nil {
			return status.Error(codes.InvalidArgument, "missing begin")
		}
		if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}); err != nil {
			return err
		}
		req, err = s.Recv()
		if err != nil {
			return err
		}
		if req.GetCommit() == nil {
			return status.Error(codes.InvalidArgument, "missing commit")
		}
		return status.Error(codes.Unavailable, "reply lost")
	}})
	tx, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-1", "begin"), nil)
	if err != nil {
		t.Fatal(err)
	}
	err = tx.Commit()
	if !errors.Is(err, sqldriver.ErrOutcomeUnknown) || status.Code(err) != codes.Unavailable {
		t.Fatalf("commit error=%v", err)
	}
}

func TestBeginHonorsReadOnlyAndRejectsCustomIsolation(t *testing.T) {
	beginCount := 0
	pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		req, err := s.Recv()
		if err != nil {
			return err
		}
		beginCount++
		if req.GetBegin() == nil || !req.GetBegin().ReadOnly || req.GetBegin().Namespace != "stacks-7" {
			return status.Error(codes.InvalidArgument, "read-only begin not forwarded")
		}
		if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}); err != nil {
			return err
		}
		req, err = s.Recv()
		if err != nil {
			return err
		}
		if req.GetRollback() == nil {
			return status.Error(codes.InvalidArgument, "expected rollback")
		}
		return s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}})
	}})
	ctx := sqldriver.WithQuery(context.Background(), "stacks-7", "unused.begin")
	if _, err := pool.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable}); !errors.Is(err, sqldriver.ErrUnsupported) {
		t.Fatalf("isolation error = %v", err)
	}
	tx, err := pool.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}
	if beginCount != 1 {
		t.Fatalf("remote begins = %d", beginCount)
	}
}

func TestCancelledTransactionStatementAbortsWithoutAutocommit(t *testing.T) {
	entered := make(chan struct{})
	pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		if _, err := s.Recv(); err != nil {
			return err
		}
		if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}); err != nil {
			return err
		}
		request, err := s.Recv()
		if err != nil {
			return err
		}
		if request.GetExec() == nil {
			return status.Error(codes.InvalidArgument, "expected exec")
		}
		close(entered)
		<-s.Context().Done()
		return s.Context().Err()
	}})
	tx, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-1", "begin"), nil)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(sqldriver.WithQuery(context.Background(), "stacks-1", "write.cancelled"))
	finished := make(chan error, 1)
	go func() { _, err := tx.ExecContext(ctx, "INSERT INTO t VALUES (1)"); finished <- err }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("statement never reached server")
	}
	cancel()
	select {
	case err := <-finished:
		if err == nil {
			t.Fatal("cancelled statement succeeded")
		}
	case <-time.After(time.Second):
		t.Fatal("statement did not cancel")
	}
	if _, err := tx.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-1", "write.after"), "INSERT INTO t VALUES (2)"); err == nil {
		t.Fatal("write after cancellation succeeded")
	}
	_ = tx.Rollback()
}

func sendTransactionOK(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
	return s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}})
}

func acceptTransactionBegin(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
	request, err := s.Recv()
	if err != nil {
		return err
	}
	if request.GetBegin() == nil {
		return status.Error(codes.InvalidArgument, "expected begin")
	}
	return sendTransactionOK(s)
}

type observedTransactionClient struct {
	dbproxyv1.DatabaseProxyServiceClient
	ready chan struct{}
}

func (c *observedTransactionClient) Transaction(ctx context.Context, opts ...grpc.CallOption) (grpc.BidiStreamingClient[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse], error) {
	stream, err := c.DatabaseProxyServiceClient.Transaction(ctx, opts...)
	if err != nil {
		return nil, err
	}
	return &observedTransactionStream{BidiStreamingClient: stream, ready: c.ready}, nil
}

type observedTransactionStream struct {
	grpc.BidiStreamingClient[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]
	ready    chan struct{}
	first    bool
	finalErr error
}

func (s *observedTransactionStream) Recv() (*dbproxyv1.TransactionResponse, error) {
	if s.first {
		<-s.ready
		return nil, s.finalErr
	}
	response, err := s.BidiStreamingClient.Recv()
	if err != nil {
		return nil, err
	}
	s.first = true
	go func() {
		_, s.finalErr = s.BidiStreamingClient.Recv()
		close(s.ready)
	}()
	return response, nil
}

func TestServerTerminationBetweenCommandsPreservesStatus(t *testing.T) {
	ready := make(chan struct{})
	serverErr, err := status.New(codes.Unavailable, "server stopped").WithDetails(&dbproxyv1.QueryError{Reason: dbproxyv1.ErrorReason_ERROR_REASON_DATABASE_UNAVAILABLE})
	if err != nil {
		t.Fatal(err)
	}
	pool := openServerPoolWithClient(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		if err := acceptTransactionBegin(s); err != nil {
			return err
		}
		return serverErr.Err()
	}}, func(client dbproxyv1.DatabaseProxyServiceClient) dbproxyv1.DatabaseProxyServiceClient {
		return &observedTransactionClient{DatabaseProxyServiceClient: client, ready: ready}
	})
	tx, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-1", "begin"), nil)
	if err != nil {
		t.Fatal(err)
	}
	select {
	case <-ready:
	case <-time.After(time.Second):
		t.Fatal("stream did not terminate")
	}
	_, err = tx.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-1", "write.after.end"), "UPDATE t SET n=1")
	if status.Code(err) != codes.Unavailable {
		t.Fatalf("status = %v", err)
	}
	st, _ := status.FromError(err)
	if len(st.Details()) != 1 {
		t.Fatalf("details = %v", st.Details())
	}
	if _, ok := st.Details()[0].(*dbproxyv1.QueryError); !ok {
		t.Fatalf("details = %v", st.Details())
	}
	_ = tx.Rollback()
}

func TestCommitOKWinsOverStreamTeardownError(t *testing.T) {
	pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		if _, err := s.Recv(); err != nil {
			return err
		}
		if err := sendTransactionOK(s); err != nil {
			return err
		}
		request, err := s.Recv()
		if err != nil {
			return err
		}
		if request.GetCommit() == nil {
			return status.Error(codes.InvalidArgument, "expected commit")
		}
		if err := sendTransactionOK(s); err != nil {
			return err
		}
		return status.Error(codes.Unavailable, "teardown failed")
	}})
	tx, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-1", "begin"), nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("confirmed commit failed: %v", err)
	}
}

func TestFailedTransactionEndAllowsNewConnectionWork(t *testing.T) {
	pool := openServerPool(t, &queryServer{
		transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
			if _, err := s.Recv(); err != nil {
				return err
			}
			if err := sendTransactionOK(s); err != nil {
				return err
			}
			if _, err := s.Recv(); err != nil {
				return err
			}
			return status.Error(codes.Unavailable, "transaction lost")
		},
		query: func(_ *dbproxyv1.QueryRequest, s grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
			return s.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}})
		},
	})
	pool.SetMaxOpenConns(1)
	tx, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-1", "begin"), nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-1", "write.fail"), "UPDATE t SET n=1"); err == nil {
		t.Fatal("fatal statement succeeded")
	}
	if err := tx.Rollback(); err == nil {
		t.Fatal("aborted rollback reported success")
	}
	rows, err := pool.QueryContext(sqldriver.WithQuery(context.Background(), "stacks-1", "read.after"), "SELECT n")
	if err != nil {
		t.Fatalf("connection remained poisoned: %v", err)
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

func TestTransactionQueryWithoutCompletionAborts(t *testing.T) {
	pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		if _, err := s.Recv(); err != nil {
			return err
		}
		if err := sendTransactionOK(s); err != nil {
			return err
		}
		if _, err := s.Recv(); err != nil {
			return err
		}
		return s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}}}})
	}})
	tx, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-1", "begin"), nil)
	if err != nil {
		t.Fatal(err)
	}
	rows, err := tx.QueryContext(sqldriver.WithQuery(context.Background(), "stacks-1", "read.incomplete"), "SELECT n")
	if err != nil {
		t.Fatal(err)
	}
	if rows.Next() || rows.Err() == nil {
		t.Fatalf("incomplete rows error = %v", rows.Err())
	}
	if err := rows.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-1", "write.after"), "DELETE FROM t"); err == nil {
		t.Fatal("write after incomplete query succeeded")
	}
	_ = tx.Rollback()
}

func TestObservedQueryErrorAllowsFollowingStatement(t *testing.T) {
	pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		if _, err := s.Recv(); err != nil {
			return err
		}
		if err := sendTransactionOK(s); err != nil {
			return err
		}
		if _, err := s.Recv(); err != nil {
			return err
		}
		if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}}}}); err != nil {
			return err
		}
		if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Error{Error: &dbproxyv1.TransactionCommandError{Message: "statement failed", DatabaseError: &dbproxyv1.DatabaseError{Code: "1062", SqlState: "23000"}}}}); err != nil {
			return err
		}
		request, err := s.Recv()
		if err != nil {
			return err
		}
		if request.GetExec() == nil {
			return status.Error(codes.InvalidArgument, "expected later exec")
		}
		if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Exec{Exec: &dbproxyv1.ExecResponse{RowsAffected: 1}}}); err != nil {
			return err
		}
		request, err = s.Recv()
		if err != nil {
			return err
		}
		if request.GetRollback() == nil {
			return status.Error(codes.InvalidArgument, "expected rollback")
		}
		return sendTransactionOK(s)
	}})
	tx, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-1", "begin"), nil)
	if err != nil {
		t.Fatal(err)
	}
	rows, err := tx.QueryContext(sqldriver.WithQuery(context.Background(), "stacks-1", "read.error"), "SELECT n")
	if err != nil {
		t.Fatal(err)
	}
	if rows.Next() || status.Code(rows.Err()) != codes.FailedPrecondition {
		t.Fatalf("query error = %v", rows.Err())
	}
	if err := rows.Close(); err != nil {
		t.Fatal(err)
	}
	result, err := tx.ExecContext(sqldriver.WithQuery(context.Background(), "stacks-1", "write.after"), "UPDATE t SET n=1")
	if err != nil {
		t.Fatal(err)
	}
	assertResult(t, result, 1, 0)
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}
}

func TestTransactionStatementDeadlineIsForwarded(t *testing.T) {
	timeouts := make(chan time.Duration, 1)
	pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		if _, err := s.Recv(); err != nil {
			return err
		}
		if err := sendTransactionOK(s); err != nil {
			return err
		}
		request, err := s.Recv()
		if err != nil {
			return err
		}
		if request.Timeout == nil {
			return status.Error(codes.InvalidArgument, "missing command timeout")
		}
		timeouts <- request.Timeout.AsDuration()
		if err := s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Exec{Exec: &dbproxyv1.ExecResponse{}}}); err != nil {
			return err
		}
		if _, err := s.Recv(); err != nil {
			return err
		}
		return sendTransactionOK(s)
	}})
	tx, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-1", "begin"), nil)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(sqldriver.WithQuery(context.Background(), "stacks-1", "write.timed"), 5*time.Second)
	defer cancel()
	if _, err := tx.ExecContext(ctx, "UPDATE t SET n=1"); err != nil {
		t.Fatal(err)
	}
	if got := <-timeouts; got <= 0 || got > 5*time.Second {
		t.Fatalf("command timeout = %v", got)
	}
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}
}

func TestOlderServerRejectsWritesWithoutUnknownOutcome(t *testing.T) {
	pool := openServerPool(t, &queryServer{})
	ctx := sqldriver.WithQuery(context.Background(), "stacks-1", "write.old.server")
	if _, err := pool.ExecContext(ctx, "UPDATE t SET n=1"); status.Code(err) != codes.Unimplemented || errors.Is(err, sqldriver.ErrOutcomeUnknown) {
		t.Fatalf("exec error = %v", err)
	}
	if _, err := pool.BeginTx(ctx, nil); status.Code(err) != codes.Unimplemented || errors.Is(err, sqldriver.ErrOutcomeUnknown) {
		t.Fatalf("begin error = %v", err)
	}
}

func TestMalformedTransactionResultsAbortBeforeLaterSQL(t *testing.T) {
	cases := []struct {
		name     string
		query    bool
		response *dbproxyv1.TransactionResponse
	}{
		{name: "missing result", response: &dbproxyv1.TransactionResponse{}},
		{name: "ok for exec", response: &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}},
		{name: "exec for query", query: true, response: &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Exec{Exec: &dbproxyv1.ExecResponse{}}}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			unexpected := make(chan *dbproxyv1.TransactionRequest, 1)
			checked := make(chan struct{})
			pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
				defer close(checked)
				if err := acceptTransactionBegin(s); err != nil {
					return err
				}
				request, err := s.Recv()
				if err != nil {
					return err
				}
				if test.query && request.GetQuery() == nil || !test.query && request.GetExec() == nil {
					return status.Error(codes.InvalidArgument, "wrong statement command")
				}
				if err := s.Send(test.response); err != nil {
					return err
				}
				if next, err := s.Recv(); err == nil {
					unexpected <- next
				}
				return nil
			}})
			tx, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-1", "begin"), nil)
			if err != nil {
				t.Fatal(err)
			}
			ctx := sqldriver.WithQuery(context.Background(), "stacks-1", "statement.malformed")
			if test.query {
				_, err = tx.QueryContext(ctx, "SELECT n")
			} else {
				_, err = tx.ExecContext(ctx, "UPDATE t SET n=1")
			}
			if err == nil {
				t.Fatal("malformed response succeeded")
			}
			if err := tx.Commit(); err == nil {
				t.Fatal("commit after malformed response succeeded")
			}
			select {
			case <-checked:
			case <-time.After(time.Second):
				t.Fatal("server did not finish checking for a later command")
			}
			select {
			case next := <-unexpected:
				t.Fatalf("unexpected later command: %v", next)
			default:
			}
		})
	}
}

func TestMalformedBeginResultDoesNotStartTransaction(t *testing.T) {
	pool := openServerPool(t, &queryServer{transaction: func(s grpc.BidiStreamingServer[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]) error {
		request, err := s.Recv()
		if err != nil {
			return err
		}
		if request.GetBegin() == nil {
			return status.Error(codes.InvalidArgument, "expected begin")
		}
		return s.Send(&dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Exec{Exec: &dbproxyv1.ExecResponse{}}})
	}})
	if _, err := pool.BeginTx(sqldriver.WithQuery(context.Background(), "stacks-1", "begin"), nil); err == nil {
		t.Fatal("malformed begin result started transaction")
	}
}
