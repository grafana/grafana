package sqldriver

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"sync"
	"time"

	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"github.com/grafana/grafana/pkg/storage/dbproxy/client"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/durationpb"
	"google.golang.org/protobuf/types/known/emptypb"
)

// ErrOutcomeUnknown marks a write or commit whose result was lost after dispatch.
var ErrOutcomeUnknown = errors.New("single-tenant database proxy: outcome unknown")
var errTransactionAborted = errors.New("single-tenant database proxy: transaction aborted")

type execResult struct{ affected, id int64 }

func (r execResult) RowsAffected() (int64, error) { return r.affected, nil }
func (r execResult) LastInsertId() (int64, error) { return r.id, nil }

func standaloneExecError(err error) error {
	if errors.Is(err, client.ErrNotSent) || status.Code(err) == codes.Unimplemented || definiteRejection(err) {
		return fmt.Errorf("proxy exec: %w", err)
	}
	return fmt.Errorf("proxy exec: %w: %w", ErrOutcomeUnknown, err)
}

func definiteRejection(err error) bool {
	st, ok := status.FromError(err)
	if !ok {
		return false
	}
	for _, detail := range st.Details() {
		if q, ok := detail.(*dbproxyv1.QueryError); ok {
			switch q.Reason {
			case dbproxyv1.ErrorReason_ERROR_REASON_INVALID_REQUEST,
				dbproxyv1.ErrorReason_ERROR_REASON_UNAUTHENTICATED,
				dbproxyv1.ErrorReason_ERROR_REASON_PERMISSION_DENIED,
				dbproxyv1.ErrorReason_ERROR_REASON_STACK_NOT_FOUND,
				dbproxyv1.ErrorReason_ERROR_REASON_STACK_STATE_UNSUPPORTED,
				dbproxyv1.ErrorReason_ERROR_REASON_QUERY_UNSUPPORTED,
				dbproxyv1.ErrorReason_ERROR_REASON_ROUTING_UNAVAILABLE,
				dbproxyv1.ErrorReason_ERROR_REASON_SQL_ERROR,
				dbproxyv1.ErrorReason_ERROR_REASON_LIMIT_EXCEEDED:
				return true
			case dbproxyv1.ErrorReason_ERROR_REASON_UNSPECIFIED,
				dbproxyv1.ErrorReason_ERROR_REASON_DATABASE_UNAVAILABLE,
				dbproxyv1.ErrorReason_ERROR_REASON_DEADLINE_EXCEEDED,
				dbproxyv1.ErrorReason_ERROR_REASON_CANCELLED,
				dbproxyv1.ErrorReason_ERROR_REASON_INTERNAL,
				dbproxyv1.ErrorReason_ERROR_REASON_OUTCOME_UNKNOWN:
				return false
			default:
				return false
			}
		}
	}
	return false
}

type transaction struct {
	conn      *conn
	namespace string
	stream    grpc.BidiStreamingClient[dbproxyv1.TransactionRequest, dbproxyv1.TransactionResponse]
	life      context.Context
	cancel    context.CancelFunc
	mu        sync.Mutex
	pending   bool
	ended     bool
}

func (c *conn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	if opts.Isolation != driver.IsolationLevel(0) {
		return nil, fmt.Errorf("proxy begin: unsupported isolation level %d: %w", opts.Isolation, ErrUnsupported)
	}
	identity, ok := ctx.Value(queryContextKey{}).(queryIdentity)
	if !ok || !validNamespace(identity.namespace) {
		return nil, errors.New("proxy begin: valid stack namespace required")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if c.tx != nil {
		return nil, errTransactionAborted
	}
	life, cancel := context.WithCancel(ctx)
	stream, err := c.client.Transaction(life)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("proxy begin: %w", err)
	}
	tx := &transaction{conn: c, namespace: identity.namespace, stream: stream, life: life, cancel: cancel}
	context.AfterFunc(life, tx.abort)
	if err := tx.send(ctx, &dbproxyv1.TransactionRequest{Command: &dbproxyv1.TransactionRequest_Begin{Begin: &dbproxyv1.BeginRequest{Namespace: identity.namespace, ReadOnly: opts.ReadOnly}}}); err != nil {
		tx.abort()
		return nil, fmt.Errorf("proxy begin: %w", err)
	}
	reply, err := stream.Recv()
	if err != nil {
		tx.abort()
		return nil, fmt.Errorf("proxy begin: %w", err)
	}
	if reply == nil || reply.GetOk() == nil {
		tx.abort()
		return nil, errors.New("proxy begin: expected ok result")
	}
	if err := ctx.Err(); err != nil {
		tx.abort()
		return nil, err
	}
	c.tx = tx
	return tx, nil
}

func (t *transaction) start(ctx context.Context) (func() bool, error) {
	if t.life.Err() != nil {
		t.abort()
		return nil, errTransactionAborted
	}
	t.mu.Lock()
	if t.ended {
		t.mu.Unlock()
		return nil, errTransactionAborted
	}
	if t.pending {
		t.mu.Unlock()
		return nil, errors.New("proxy transaction: previous command still has open rows")
	}
	t.pending = true
	t.mu.Unlock()
	if err := ctx.Err(); err != nil {
		t.abort()
		return nil, err
	}
	stop := context.AfterFunc(ctx, t.abort)
	return func() bool {
		completed := stop()
		if !completed {
			// The cancellation callback may still be running. Mark the transaction
			// aborted before allowing another command to start.
			t.abort()
		}
		t.mu.Lock()
		t.pending = false
		t.mu.Unlock()
		return completed
	}, nil
}
func (t *transaction) abort() {
	t.mu.Lock()
	t.ended = true
	t.mu.Unlock()
	// Keep the transaction attached until Commit or Rollback returns, so an
	// attempted statement on the same sql.Tx cannot fall through to autocommit.
	t.cancel()
}
func (t *transaction) finish() {
	t.mu.Lock()
	t.ended = true
	t.mu.Unlock()
	// database/sql will never use this sql.Tx again after an end call returns.
	// The logical connection can then serve a new transaction or standalone call.
	t.conn.tx = nil
	t.cancel()
}
func (t *transaction) send(ctx context.Context, request *dbproxyv1.TransactionRequest) error {
	if deadline, ok := ctx.Deadline(); ok {
		remaining := time.Until(deadline)
		if remaining <= 0 {
			return context.DeadlineExceeded
		}
		request.Timeout = durationpb.New(remaining)
	}
	if err := t.stream.Send(request); err != nil {
		if errors.Is(err, io.EOF) {
			// gRPC can report a terminated stream as EOF from Send while the
			// server's actual status and details are still waiting in Recv.
			if _, finalErr := t.stream.Recv(); finalErr != nil && !errors.Is(finalErr, io.EOF) {
				return finalErr
			}
			return errors.New("proxy transaction: stream ended while sending command")
		}
		return err
	}
	return nil
}
func (t *transaction) recv() (*dbproxyv1.TransactionResponse, error) {
	reply, err := t.stream.Recv()
	if err != nil {
		t.abort()
		if errors.Is(err, io.EOF) {
			return nil, errors.New("proxy transaction: stream ended before command completed")
		}
		return nil, fmt.Errorf("proxy transaction: %w", err)
	}
	if reply == nil || reply.Result == nil {
		t.abort()
		return nil, errors.New("proxy transaction: missing result")
	}
	return reply, nil
}
func (t *transaction) checkIdentity(identity queryIdentity) error {
	if identity.namespace != t.namespace {
		return errors.New("proxy transaction: stack namespace differs from Begin")
	}
	return nil
}
func (t *transaction) exec(ctx context.Context, identity queryIdentity, query string, params []*dbproxyv1.Value) (driver.Result, error) {
	if err := t.checkIdentity(identity); err != nil {
		return nil, err
	}
	done, err := t.start(ctx)
	if err != nil {
		return nil, err
	}
	if err := t.send(ctx, &dbproxyv1.TransactionRequest{Command: &dbproxyv1.TransactionRequest_Exec{Exec: &dbproxyv1.Statement{QueryName: identity.name, Sql: query, Parameters: params}}}); err != nil {
		t.abort()
		done()
		return nil, fmt.Errorf("proxy transaction exec: %w", err)
	}
	reply, err := t.recv()
	completed := done()
	if err != nil {
		return nil, err
	}
	if !completed {
		return nil, fmt.Errorf("proxy transaction exec: %w", ctx.Err())
	}
	switch result := reply.Result.(type) {
	case *dbproxyv1.TransactionResponse_Exec:
		if result.Exec == nil {
			t.abort()
			return nil, errors.New("proxy transaction exec: missing result")
		}
		return execResult{result.Exec.RowsAffected, result.Exec.LastInsertId}, nil
	case *dbproxyv1.TransactionResponse_Error:
		if result.Error == nil {
			t.abort()
			return nil, errors.New("proxy transaction exec: missing error")
		}
		return nil, commandError(result.Error)
	default:
		t.abort()
		return nil, errors.New("proxy transaction exec: expected exec or error result")
	}
}
func (t *transaction) query(ctx context.Context, identity queryIdentity, query string, params []*dbproxyv1.Value) (driver.Rows, error) {
	if err := t.checkIdentity(identity); err != nil {
		return nil, err
	}
	done, err := t.start(ctx)
	if err != nil {
		return nil, err
	}
	if err := t.send(ctx, &dbproxyv1.TransactionRequest{Command: &dbproxyv1.TransactionRequest_Query{Query: &dbproxyv1.Statement{QueryName: identity.name, Sql: query, Parameters: params}}}); err != nil {
		done()
		t.abort()
		return nil, fmt.Errorf("proxy transaction query: %w", err)
	}
	reply, err := t.recv()
	if err != nil {
		done()
		return nil, err
	}
	if result, ok := reply.Result.(*dbproxyv1.TransactionResponse_Error); ok {
		done()
		if result.Error == nil {
			t.abort()
			return nil, errors.New("proxy transaction query: missing error")
		}
		return nil, commandError(result.Error)
	}
	result, ok := reply.Result.(*dbproxyv1.TransactionResponse_Query)
	if !ok {
		done()
		t.abort()
		return nil, errors.New("proxy transaction query: expected schema result")
	}
	if err := validateSchema(result.Query); err != nil {
		done()
		t.abort()
		return nil, fmt.Errorf("proxy transaction query: %w", err)
	}
	r := &transactionRows{tx: t}
	r.rows = &rows{
		columns: result.Query.Columns,
		stream:  transactionQueryStream{tx: t},
		cancel: func() {
			if !done() {
				r.completionErr = ctx.Err()
			}
		},
	}
	return r, nil
}
func (t *transaction) end(commit bool) error {
	defer t.finish()
	ctx := context.Background()
	done, err := t.start(ctx)
	if err != nil {
		return err
	}
	defer done()
	request := &dbproxyv1.TransactionRequest{Command: &dbproxyv1.TransactionRequest_Rollback{Rollback: &emptypb.Empty{}}}
	if commit {
		request.Command = &dbproxyv1.TransactionRequest_Commit{Commit: &emptypb.Empty{}}
	}
	if err := t.send(ctx, request); err != nil {
		t.abort()
		if commit {
			return fmt.Errorf("proxy commit: %w: %w", ErrOutcomeUnknown, err)
		}
		return fmt.Errorf("proxy rollback: %w", err)
	}
	reply, err := t.recv()
	if err != nil {
		if commit {
			return fmt.Errorf("proxy commit: %w: %w", ErrOutcomeUnknown, err)
		}
		return err
	}
	if reply.GetOk() == nil {
		t.abort()
		if commit {
			return fmt.Errorf("proxy commit: %w: expected ok result", ErrOutcomeUnknown)
		}
		return errors.New("proxy transaction: expected ok result")
	}
	return nil
}
func (t *transaction) Commit() error   { return t.end(true) }
func (t *transaction) Rollback() error { return t.end(false) }

func commandError(e *dbproxyv1.TransactionCommandError) error {
	if e == nil {
		return status.Error(codes.FailedPrecondition, "proxy transaction command failed")
	}
	st := status.New(codes.FailedPrecondition, e.Message)
	with, err := st.WithDetails(&dbproxyv1.QueryError{Reason: dbproxyv1.ErrorReason_ERROR_REASON_SQL_ERROR, DatabaseError: e.DatabaseError})
	if err != nil {
		return st.Err()
	}
	return with.Err()
}

type transactionRows struct {
	*rows
	tx            *transaction
	completionErr error
}

const rowsDrainTimeout = time.Second

func (r *transactionRows) Close() error {
	if r.done {
		return nil
	}
	// database/sql closes open rows before calling the driver's Rollback.
	// Bound the drain so Rollback can finish even if Recv is stalled.
	timer := time.AfterFunc(rowsDrainTimeout, r.tx.abort)
	err := r.drain()
	if !timer.Stop() {
		// The callback may still be running. Abort before releasing the connection.
		r.tx.abort()
		return fmt.Errorf("proxy transaction: timed out draining rows: %w", context.DeadlineExceeded)
	}
	if err != nil {
		r.tx.abort()
	}
	return err
}

func (r *transactionRows) drain() error {
	// Consume the terminal frame before allowing another command on the stream.
	values := make([]driver.Value, len(r.columns))
	for {
		err := r.next(values)
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
	}
}
func (r *transactionRows) next(dest []driver.Value) error {
	if r.done {
		return io.EOF
	}
	err := r.rows.Next(dest)
	// Next runs the cleanup callback before reporting the terminal frame.
	if errors.Is(err, io.EOF) && r.completionErr != nil {
		return r.completionErr
	}
	return err
}

func (r *transactionRows) Next(dest []driver.Value) error {
	err := r.next(dest)
	if err != nil && !errors.Is(err, io.EOF) && !recoverableError(err) {
		r.tx.abort()
	}
	return err
}

type transactionQueryStream struct{ tx *transaction }

func (s transactionQueryStream) Recv() (*dbproxyv1.QueryResponse, error) {
	reply, err := s.tx.recv()
	if err != nil {
		return nil, err
	}
	switch result := reply.Result.(type) {
	case *dbproxyv1.TransactionResponse_Query:
		return result.Query, nil
	case *dbproxyv1.TransactionResponse_Ok:
		return nil, io.EOF
	case *dbproxyv1.TransactionResponse_Error:
		if result.Error == nil {
			s.tx.abort()
			return nil, errors.New("proxy transaction query: missing error")
		}
		return nil, commandError(result.Error)
	default:
		s.tx.abort()
		return nil, errors.New("proxy transaction query: unexpected result")
	}
}
func recoverableError(err error) bool {
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.FailedPrecondition {
		return false
	}
	for _, detail := range st.Details() {
		if q, ok := detail.(*dbproxyv1.QueryError); ok {
			return q.Reason == dbproxyv1.ErrorReason_ERROR_REASON_SQL_ERROR
		}
	}
	return false
}
