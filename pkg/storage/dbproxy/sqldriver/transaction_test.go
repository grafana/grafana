package sqldriver_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"testing/synctest"
	"time"

	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"github.com/grafana/grafana/pkg/storage/dbproxy/sqldriver"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/emptypb"
)

func TestStalledTransactionRowsAbortOnClose(t *testing.T) {
	for _, operation := range []string{"rollback with open rows", "explicit close before commit"} {
		t.Run(operation, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				stream := &stalledTransactionStream{
					responses: []*dbproxyv1.TransactionResponse{
						{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}},
						{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{
							Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}},
						}}},
					},
				}
				connector, err := sqldriver.New(stalledTransactionClient{stream: stream}).OpenConnector("")
				if err != nil {
					t.Fatal(err)
				}
				pool := sql.OpenDB(connector)
				defer func() {
					if err := pool.Close(); err != nil {
						t.Errorf("close pool: %v", err)
					}
				}()
				ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "read.stalled")
				tx, err := pool.BeginTx(ctx, nil)
				if err != nil {
					t.Fatal(err)
				}
				defer func() { _ = tx.Rollback() }()
				rows, err := tx.QueryContext(ctx, "SELECT n")
				if err != nil {
					t.Fatal(err)
				}

				if operation == "rollback with open rows" {
					if err := tx.Rollback(); err == nil {
						t.Fatal("rollback reported success without a server acknowledgement")
					}
				} else {
					if err := rows.Close(); !errors.Is(err, context.DeadlineExceeded) {
						t.Fatalf("close error = %v, want deadline exceeded", err)
					}
					if err := tx.Commit(); err == nil || errors.Is(err, sqldriver.ErrOutcomeUnknown) {
						t.Fatalf("commit error = %v, want failure before dispatch", err)
					}
				}
				if err := stream.ctx.Err(); !errors.Is(err, context.Canceled) {
					t.Fatalf("stream context error = %v, want canceled", err)
				}
				if len(stream.requests) != 2 || stream.requests[0].GetBegin() == nil || stream.requests[1].GetQuery() == nil {
					t.Fatalf("expected only begin and query, got %v", stream.requests)
				}
			})
		})
	}
}

func TestTransactionExecDeadlineAtReply(t *testing.T) {
	for _, tc := range []struct {
		name         string
		expireInRecv bool
	}{
		{name: "deadline wins", expireInRecv: true},
		{name: "exec wins"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ok := &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}
				ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "write.deadline")
				stmtCtx, cancel := context.WithTimeout(ctx, time.Second)
				defer cancel()
				stream := &stalledTransactionStream{
					responses: []*dbproxyv1.TransactionResponse{
						ok,
						{Result: &dbproxyv1.TransactionResponse_Exec{Exec: &dbproxyv1.ExecResponse{RowsAffected: 1}}},
						ok,
					},
				}
				if tc.expireInRecv {
					stream.beforeReply = func(reply *dbproxyv1.TransactionResponse) {
						if reply.GetExec() == nil {
							return
						}
						<-stmtCtx.Done()
						synctest.Wait() // Let an already-armed abort callback run before delivering the reply.
					}
				}
				connector, err := sqldriver.New(stalledTransactionClient{stream: stream}).OpenConnector("")
				if err != nil {
					t.Fatal(err)
				}
				pool := sql.OpenDB(connector)
				t.Cleanup(func() { _ = pool.Close() })
				tx, err := pool.BeginTx(ctx, nil)
				if err != nil {
					t.Fatal(err)
				}
				defer func() { _ = tx.Rollback() }()

				result, execErr := tx.ExecContext(stmtCtx, "UPDATE t SET n=1")
				<-stmtCtx.Done()
				synctest.Wait()
				commitErr := tx.Commit()
				if tc.expireInRecv {
					if !errors.Is(execErr, context.DeadlineExceeded) || result != nil || commitErr == nil {
						t.Fatalf("ExecContext = (%v, %v), Commit = %v; want deadline error and failed commit", result, execErr, commitErr)
					}
					if len(stream.requests) != 2 {
						t.Fatalf("expected no command after aborted exec, got %v", stream.requests)
					}
					return
				}
				if execErr != nil || commitErr != nil {
					t.Fatalf("ExecContext = %v, Commit = %v; want both to succeed", execErr, commitErr)
				}
				assertResult(t, result, 1, 0)
			})
		})
	}
}

func TestTransactionRowsDeadlineAtCompletion(t *testing.T) {
	for _, earlyClose := range []bool{false, true} {
		name := "iterate"
		if earlyClose {
			name = "close"
		}
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "read.deadline")
				stmtCtx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
				defer cancel()
				beginOK := &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}
				queryOK := &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}
				stream := &stalledTransactionStream{
					responses: []*dbproxyv1.TransactionResponse{
						beginOK,
						{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{
							Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}},
						}}},
						queryOK,
					},
					beforeReply: func(reply *dbproxyv1.TransactionResponse) {
						if reply == queryOK {
							<-stmtCtx.Done()
							synctest.Wait()
						}
					},
				}
				connector, err := sqldriver.New(stalledTransactionClient{stream: stream}).OpenConnector("")
				if err != nil {
					t.Fatal(err)
				}
				pool := sql.OpenDB(connector)
				t.Cleanup(func() { _ = pool.Close() })
				tx, err := pool.BeginTx(ctx, nil)
				if err != nil {
					t.Fatal(err)
				}
				defer func() { _ = tx.Rollback() }()
				rows, err := tx.QueryContext(stmtCtx, "SELECT n")
				if err != nil {
					t.Fatal(err)
				}
				if earlyClose {
					err = rows.Close()
				} else {
					if rows.Next() {
						t.Fatal("unexpected row")
					}
					err = rows.Err()
				}
				if !errors.Is(err, context.DeadlineExceeded) {
					t.Fatalf("rows error = %v, want statement deadline exceeded", err)
				}
				if err := tx.Commit(); err == nil || errors.Is(err, sqldriver.ErrOutcomeUnknown) {
					t.Fatalf("commit error = %v, want failure before dispatch", err)
				}
				if len(stream.requests) != 2 {
					t.Fatalf("expected only begin and query, got %v", stream.requests)
				}
			})
		})
	}
}

type stalledTransactionClient struct {
	dbproxyv1.DatabaseProxyServiceClient
	stream *stalledTransactionStream
}

func (c stalledTransactionClient) Transaction(ctx context.Context, _ ...grpc.CallOption) (grpc.BidiStreamingClient[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse], error) {
	c.stream.ctx = ctx
	return c.stream, nil
}

type stalledTransactionStream struct {
	grpc.BidiStreamingClient[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]
	ctx         context.Context
	requests    []*dbproxyv1.TransactionRequest
	responses   []*dbproxyv1.TransactionResponse
	beforeReply func(*dbproxyv1.TransactionResponse)
}

func (s *stalledTransactionStream) Send(req *dbproxyv1.TransactionRequest) error {
	s.requests = append(s.requests, req)
	return nil
}

func (s *stalledTransactionStream) Recv() (*dbproxyv1.TransactionResponse, error) {
	if len(s.responses) == 0 {
		<-s.ctx.Done()
		return nil, s.ctx.Err()
	}
	resp := s.responses[0]
	s.responses = s.responses[1:]
	if s.beforeReply != nil {
		s.beforeReply(resp)
	}
	return resp, nil
}
