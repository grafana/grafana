package sqldriver_test

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"github.com/grafana/grafana/pkg/storage/dbproxy/sqldriver"
)

const (
	testStack = "stacks-1"
	selectN   = "SELECT n"
	updateN   = "UPDATE t SET n=1"
)

func TestStalledTransactionRowsAbortOnClose(t *testing.T) {
	for _, tc := range []struct {
		name     string
		rollback bool
	}{
		{name: "rollback with open rows", rollback: true},
		{name: "explicit close before commit"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				stream := fakeTransaction(schemaReply())
				ctx := sqldriver.WithQuery(t.Context(), testStack, "read.stalled")
				tx := beginFakeTransaction(t, ctx, stream)
				rows, err := tx.QueryContext(ctx, selectN)
				require.NoError(t, err)

				if tc.rollback {
					require.Error(t, tx.Rollback(), "rollback cannot report success without acknowledgement")
				} else {
					require.ErrorIs(t, rows.Close(), context.DeadlineExceeded)
					requireCommitNotSent(t, tx, stream)
				}
				require.ErrorIs(t, stream.ctx.Err(), context.Canceled)
				require.Len(t, stream.requests, 2)
				require.NotNil(t, stream.requests[0].GetBegin())
				require.NotNil(t, stream.requests[1].GetQuery())
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
				ctx := sqldriver.WithQuery(t.Context(), testStack, "write.deadline")
				stmtCtx := statementTimeout(t, ctx, time.Second)
				reply := execReply()
				stream := fakeTransaction(reply, okReply())
				if tc.expireInRecv {
					stream.beforeReply = waitForCancellation(stmtCtx, reply)
				}
				tx := beginFakeTransaction(t, ctx, stream)

				result, err := tx.ExecContext(stmtCtx, updateN)
				if tc.expireInRecv {
					require.ErrorIs(t, err, context.DeadlineExceeded)
					require.Nil(t, result)
					requireCommitNotSent(t, tx, stream)
					return
				}
				require.NoError(t, err)
				assertResult(t, result, 1, 0)
				<-stmtCtx.Done()
				synctest.Wait()
				require.NoError(t, tx.Commit(), "an expired statement must not abort an already completed Exec")
			})
		})
	}
}

func TestTransactionQueryDeadlineAtReply(t *testing.T) {
	for _, tc := range []struct {
		name           string
		expireAtSchema bool
		closeEarly     bool
	}{
		{name: "schema", expireAtSchema: true},
		{name: "completion during iteration"},
		{name: "completion during close", closeEarly: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx := sqldriver.WithQuery(t.Context(), testStack, "read.deadline")
				// Let the statement deadline win before the driver's drain timeout.
				stmtCtx := statementTimeout(t, ctx, 100*time.Millisecond)
				schema, completion := schemaReply(), okReply()
				stream := fakeTransaction(schema, completion)
				reply := completion
				if tc.expireAtSchema {
					reply = schema
				}
				stream.beforeReply = waitForCancellation(stmtCtx, reply)
				tx := beginFakeTransaction(t, ctx, stream)

				rows, err := tx.QueryContext(stmtCtx, selectN)
				if tc.expireAtSchema {
					require.Nil(t, rows)
				} else {
					require.NoError(t, err)
					if tc.closeEarly {
						err = rows.Close()
					} else {
						require.False(t, rows.Next())
						err = rows.Err()
					}
				}
				require.ErrorIs(t, err, context.DeadlineExceeded)
				requireCommitNotSent(t, tx, stream)
			})
		})
	}
}

func TestTransactionStatementReceiveDeadline(t *testing.T) {
	for _, operation := range []string{"exec", "query"} {
		t.Run(operation, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx := sqldriver.WithQuery(t.Context(), testStack, "statement.deadline")
				tx := beginFakeTransaction(t, ctx, fakeTransaction())
				stmtCtx := statementTimeout(t, ctx, time.Second)

				var err error
				if operation == "exec" {
					_, err = tx.ExecContext(stmtCtx, updateN)
				} else {
					_, err = tx.QueryContext(stmtCtx, selectN)
				}
				require.ErrorIs(t, err, context.DeadlineExceeded)
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
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				stream := fakeTransaction(schemaReply())
				if tc.warnings {
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
				ctx := sqldriver.WithQuery(t.Context(), testStack, "read.stalled")
				tx := beginFakeTransaction(t, ctx, stream)
				rows, err := tx.QueryContext(ctx, selectN)
				require.NoError(t, err)
				next := make(chan bool, 1)
				go func() { next <- rows.Next() }()
				synctest.Wait() // Next must be blocked in Recv before rollback starts.

				start := time.Now()
				require.Error(t, tx.Rollback(), "rollback cannot report success without acknowledgement")
				require.LessOrEqual(t, time.Since(start), 30*time.Second)
				require.False(t, <-next)
				require.ErrorIs(t, rows.Err(), context.DeadlineExceeded)
				require.ErrorIs(t, stream.ctx.Err(), context.Canceled)
				require.Len(t, stream.requests, 2)
			})
		})
	}
}

func TestUnknownCommitDoesNotExposeBadConn(t *testing.T) {
	for _, phase := range []string{"send", "receive"} {
		t.Run(phase, func(t *testing.T) {
			lost := fmt.Errorf("commit acknowledgement lost: %w", driver.ErrBadConn)
			stream := fakeTransaction()
			if phase == "send" {
				stream.commitSendErr = lost
			} else {
				stream.finalRecvErr = lost
			}
			ctx := sqldriver.WithQuery(t.Context(), testStack, "")
			err := beginFakeTransaction(t, ctx, stream).Commit()
			require.ErrorIs(t, err, sqldriver.ErrOutcomeUnknown)
			require.NotErrorIs(t, err, driver.ErrBadConn)
			require.ErrorContains(t, err, lost.Error())
			require.Len(t, stream.requests, 2)
			require.NotNil(t, stream.requests[1].GetCommit())
		})
	}
}

func TestTransactionCommitAcknowledgementAtIOTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		commitOK := okReply()
		stream := fakeTransaction(commitOK)
		stream.beforeReply = func(reply *dbproxyv1.TransactionResponse) {
			if reply == commitOK {
				<-stream.ctx.Done()
			}
		}
		ctx := sqldriver.WithQuery(t.Context(), testStack, "")
		require.NoError(t, beginFakeTransaction(t, ctx, stream).Commit())
	})
}

func TestTransactionStreamSetupTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		pool := openFakeTransactionPool(t, stalledTransactionClient{beforeOpen: func(ctx context.Context) error {
			<-ctx.Done()
			return ctx.Err()
		}})
		ctx := sqldriver.WithQuery(t.Context(), testStack, "")
		_, err := pool.BeginTx(ctx, nil)
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})
}

func TestTransactionExecWithCanceledContextBeforeCallback(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx := sqldriver.WithQuery(t.Context(), testStack, "write.cancel")
		stmt, cancel := context.WithCancel(ctx)
		t.Cleanup(cancel)
		callbackCtx, cancelCallback := context.WithCancel(ctx)
		t.Cleanup(cancelCallback)
		execOK := execReply()
		stream := fakeTransaction(execOK, okReply())
		stream.beforeReply = func(reply *dbproxyv1.TransactionResponse) {
			if reply == execOK {
				cancel()
			}
		}
		tx := beginFakeTransaction(t, ctx, stream)
		stmtCtx := sqldriver.WithQuery(delayedAfterFuncContext{Context: stmt, callbackContext: callbackCtx}, testStack, "write.cancel")
		result, err := tx.ExecContext(stmtCtx, updateN)
		require.ErrorIs(t, err, context.Canceled)
		require.Nil(t, result)
		requireCommitNotSent(t, tx, stream)
	})
}

func requireCommitNotSent(t *testing.T, tx *sql.Tx, stream *stalledTransactionStream) {
	t.Helper()
	err := tx.Commit()
	require.Error(t, err)
	require.NotErrorIs(t, err, sqldriver.ErrOutcomeUnknown)
	require.Len(t, stream.requests, 2, "expected only begin and statement requests")
}

func statementTimeout(t *testing.T, ctx context.Context, timeout time.Duration) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(ctx, timeout)
	t.Cleanup(cancel)
	return ctx
}

func waitForCancellation(ctx context.Context, target *dbproxyv1.TransactionResponse) func(*dbproxyv1.TransactionResponse) {
	return func(reply *dbproxyv1.TransactionResponse) {
		if reply == target {
			<-ctx.Done()
			synctest.Wait() // Let the abort callback run before delivering the buffered reply.
		}
	}
}

func openFakeTransactionPool(t *testing.T, client stalledTransactionClient) *sql.DB {
	t.Helper()
	connector, err := sqldriver.New(client).OpenConnector("")
	require.NoError(t, err)
	pool := sql.OpenDB(connector)
	t.Cleanup(func() { require.NoError(t, pool.Close()) })
	return pool
}

func beginFakeTransaction(t *testing.T, ctx context.Context, stream *stalledTransactionStream) *sql.Tx {
	t.Helper()
	pool := openFakeTransactionPool(t, stalledTransactionClient{stream: stream})
	tx, err := pool.BeginTx(ctx, nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback() })
	return tx
}

func fakeTransaction(replies ...*dbproxyv1.TransactionResponse) *stalledTransactionStream {
	return &stalledTransactionStream{responses: append([]*dbproxyv1.TransactionResponse{okReply()}, replies...)}
}

func okReply() *dbproxyv1.TransactionResponse {
	return &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Ok{Ok: &emptypb.Empty{}}}
}

func schemaReply() *dbproxyv1.TransactionResponse {
	return &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Query{Query: &dbproxyv1.QueryResponse{
		Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}},
	}}}
}

func execReply() *dbproxyv1.TransactionResponse {
	return &dbproxyv1.TransactionResponse{Result: &dbproxyv1.TransactionResponse_Exec{Exec: &dbproxyv1.ExecResponse{RowsAffected: 1}}}
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
