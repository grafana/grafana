package sqldriver_test

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"strings"
	"testing"
	"testing/synctest"
	"time"

	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"github.com/grafana/grafana/pkg/storage/dbproxy/sqldriver"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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

func TestTransactionQueryDeadlineAtSchema(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "read.deadline")
		stmtCtx, cancel := context.WithTimeout(ctx, time.Second)
		defer cancel()
		schema := &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{
			Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}},
		}}}
		stream := &stalledTransactionStream{
			responses: []*dbproxyv1.TransactionResponse{
				{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}},
				schema,
			},
			beforeReply: func(reply *dbproxyv1.TransactionResponse) {
				if reply == schema {
					<-stmtCtx.Done()
					synctest.Wait() // Let cancellation abort the stream before delivering the buffered schema.
				}
			},
		}
		tx := beginFakeTransaction(t, ctx, stream)
		rows, err := tx.QueryContext(stmtCtx, "SELECT n")
		if rows != nil || !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("QueryContext returned rows=%t, err=%v; want no rows and statement deadline exceeded", rows != nil, err)
		}
		if err := tx.Commit(); err == nil || errors.Is(err, sqldriver.ErrOutcomeUnknown) || len(stream.requests) != 2 {
			t.Fatalf("Commit = %v, requests = %v; want failure before dispatch", err, stream.requests)
		}
	})
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

func TestTransactionStatementReceiveDeadline(t *testing.T) {
	for _, operation := range []string{"exec", "query"} {
		t.Run(operation, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				stream := &stalledTransactionStream{responses: []*dbproxyv1.TransactionResponse{
					{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}},
				}}
				ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "statement.deadline")
				tx := beginFakeTransaction(t, ctx, stream)
				stmtCtx, cancel := context.WithTimeout(ctx, time.Second)
				defer cancel()

				var err error
				if operation == "exec" {
					_, err = tx.ExecContext(stmtCtx, "UPDATE t SET n=1")
				} else {
					_, err = tx.QueryContext(stmtCtx, "SELECT n")
				}
				if !errors.Is(err, context.DeadlineExceeded) {
					t.Fatalf("%s error = %v, want statement deadline exceeded", operation, err)
				}
			})
		})
	}
}

func TestTransactionRollbackWhileNextIsBlocked(t *testing.T) {
	for _, tc := range []struct {
		name     string
		warnings bool
	}{
		{name: "stalled stream"},
		{name: "warning-only frames", warnings: true},
	} {
		t.Run(tc.name, func(t *testing.T) { testTransactionRollbackWhileNextIsBlocked(t, tc.warnings) })
	}
}

func testTransactionRollbackWhileNextIsBlocked(t *testing.T, warnings bool) {
	synctest.Test(t, func(t *testing.T) {
		stream := &stalledTransactionStream{responses: []*dbproxyv1.TransactionResponse{
			{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}},
			{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{
				Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}},
			}}},
		}}
		if warnings {
			warning := &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{
				Warnings: []*dbproxyv1.Warning{{}},
			}}}
			stream.responses = append(stream.responses, warning, warning, warning)
			stream.beforeReply = func(reply *dbproxyv1.TransactionResponse) {
				if reply == warning {
					select {
					case <-time.After(20 * time.Second):
					case <-stream.ctx.Done():
					}
				}
			}
		}
		ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "read.stalled")
		tx := beginFakeTransaction(t, ctx, stream)
		rows, err := tx.QueryContext(ctx, "SELECT n")
		if err != nil {
			t.Fatal(err)
		}
		next := make(chan bool, 1)
		go func() { next <- rows.Next() }()
		synctest.Wait() // Next is blocked in Recv before rollback starts.

		start := time.Now()
		if err := tx.Rollback(); err == nil {
			t.Fatal("rollback succeeded without acknowledgement")
		}
		if elapsed := time.Since(start); elapsed > 30*time.Second {
			t.Errorf("rollback took %v, want at most one I/O timeout", elapsed)
		}
		if <-next || !errors.Is(rows.Err(), context.DeadlineExceeded) {
			t.Fatalf("rows error = %v, want I/O deadline exceeded", rows.Err())
		}
		if stream.ctx.Err() == nil || len(stream.requests) != 2 {
			t.Fatalf("expected stream cancellation without sending rollback, got %v, %v", stream.ctx.Err(), stream.requests)
		}
	})
}

func beginFakeTransaction(t *testing.T, ctx context.Context, stream *stalledTransactionStream) *sql.Tx {
	t.Helper()
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
	t.Cleanup(func() { _ = tx.Rollback() })
	return tx
}

func TestUnknownCommitDoesNotExposeBadConn(t *testing.T) {
	for _, phase := range []string{"send", "receive"} {
		t.Run(phase, func(t *testing.T) {
			lost := fmt.Errorf("commit acknowledgement lost: %w", driver.ErrBadConn)
			stream := &stalledTransactionStream{responses: []*dbproxyv1.TransactionResponse{
				{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}},
			}}
			if phase == "send" {
				stream.commitSendErr = lost
			} else {
				stream.finalRecvErr = lost
			}
			ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "")
			err := beginFakeTransaction(t, ctx, stream).Commit()
			if !errors.Is(err, sqldriver.ErrOutcomeUnknown) || errors.Is(err, driver.ErrBadConn) || !strings.Contains(err.Error(), lost.Error()) {
				t.Errorf("Commit = %v, want unknown outcome with diagnostic text but no retry sentinel", err)
			}
			if len(stream.requests) != 2 || stream.requests[1].GetCommit() == nil {
				t.Fatalf("expected a single commit attempt, got %v", stream.requests)
			}
		})
	}
}

func TestTransactionCommitAcknowledgementAtIOTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		beginOK := &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}
		commitOK := &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}
		stream := &stalledTransactionStream{responses: []*dbproxyv1.TransactionResponse{beginOK, commitOK}}
		stream.beforeReply = func(reply *dbproxyv1.TransactionResponse) {
			if reply == commitOK {
				<-stream.ctx.Done()
			}
		}
		ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "")
		if err := beginFakeTransaction(t, ctx, stream).Commit(); err != nil {
			t.Fatalf("acknowledged commit failed: %v", err)
		}
	})
}

func TestTransactionStreamSetupTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		client := stalledTransactionClient{beforeOpen: func(ctx context.Context) error {
			<-ctx.Done()
			return ctx.Err()
		}}
		connector, err := sqldriver.New(client).OpenConnector("")
		if err != nil {
			t.Fatal(err)
		}
		pool := sql.OpenDB(connector)
		t.Cleanup(func() { _ = pool.Close() })
		ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "")
		if _, err := pool.BeginTx(ctx, nil); !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("BeginTx error = %v, want I/O deadline exceeded", err)
		}
	})
}

// delayedAfterFuncContext lets the test delay delivery of the cancellation
// callback independently from the statement context's cancellation state.
type delayedAfterFuncContext struct {
	context.Context
	callbackContext context.Context
}

func (c delayedAfterFuncContext) Value(any) any { return nil }

func (c delayedAfterFuncContext) AfterFunc(f func()) func() bool {
	return context.AfterFunc(c.callbackContext, f)
}

func TestTransactionExecWithCanceledContextBeforeCallback(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		beginOK := &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}
		execOK := &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Exec{Exec: &dbproxyv1.ExecResponse{RowsAffected: 1}}}
		ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "write.cancel")
		stmt, cancel := context.WithCancel(ctx)
		defer cancel()
		callbackCtx, cancelCallback := context.WithCancel(ctx)
		defer cancelCallback()
		stream := &stalledTransactionStream{responses: []*dbproxyv1.TransactionResponse{beginOK, execOK, beginOK}}
		stream.beforeReply = func(reply *dbproxyv1.TransactionResponse) {
			if reply == execOK {
				cancel()
			}
		}
		tx := beginFakeTransaction(t, ctx, stream)
		stmtCtx := sqldriver.WithQuery(delayedAfterFuncContext{Context: stmt, callbackContext: callbackCtx}, "stacks-1", "write.cancel")
		if result, err := tx.ExecContext(stmtCtx, "UPDATE t SET n=1"); result != nil || !errors.Is(err, context.Canceled) {
			t.Errorf("ExecContext = (%v, %v), want canceled without a result", result, err)
		}
		if err := tx.Commit(); err == nil || len(stream.requests) != 2 {
			t.Fatalf("Commit = %v, requests = %v; want failure before dispatch", err, stream.requests)
		}
	})
}

type stalledTransactionClient struct {
	dbproxyv1.DatabaseProxyServiceClient
	stream     *stalledTransactionStream
	beforeOpen func(context.Context) error
}

func (c stalledTransactionClient) Transaction(ctx context.Context, _ ...grpc.CallOption) (grpc.BidiStreamingClient[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse], error) {
	if c.beforeOpen != nil {
		if err := c.beforeOpen(ctx); err != nil {
			return nil, err
		}
	}
	c.stream.ctx = ctx
	return c.stream, nil
}

type stalledTransactionStream struct {
	grpc.BidiStreamingClient[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]
	ctx           context.Context
	requests      []*dbproxyv1.TransactionRequest
	responses     []*dbproxyv1.TransactionResponse
	beforeReply   func(*dbproxyv1.TransactionResponse)
	commitSendErr error
	finalRecvErr  error
}

func (s *stalledTransactionStream) Send(req *dbproxyv1.TransactionRequest) error {
	s.requests = append(s.requests, req)
	if req.GetCommit() != nil {
		return s.commitSendErr
	}
	return nil
}

func (s *stalledTransactionStream) Recv() (*dbproxyv1.TransactionResponse, error) {
	if len(s.responses) == 0 {
		if s.finalRecvErr != nil {
			return nil, s.finalRecvErr
		}
		<-s.ctx.Done()
		return nil, status.Error(codes.Canceled, s.ctx.Err().Error())
	}
	resp := s.responses[0]
	s.responses = s.responses[1:]
	if s.beforeReply != nil {
		s.beforeReply(resp)
	}
	return resp, nil
}
