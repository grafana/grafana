package sqldriver_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"testing/synctest"

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
				defer pool.Close()
				ctx := sqldriver.WithQuery(t.Context(), "stacks-1", "read.stalled")
				tx, err := pool.BeginTx(ctx, nil)
				if err != nil {
					t.Fatal(err)
				}
				defer tx.Rollback()
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
	ctx       context.Context
	requests  []*dbproxyv1.TransactionRequest
	responses []*dbproxyv1.TransactionResponse
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
	return resp, nil
}
