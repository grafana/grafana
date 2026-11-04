package sqldriver_test

import (
	"context"
	"database/sql/driver"
	"errors"
	"math"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"github.com/grafana/grafana/pkg/storage/dbproxy/sqldriver"
	"google.golang.org/grpc"
)

type unsignedAlias uint64

type unsignedAliasValuer uint64

func (unsignedAliasValuer) Value() (driver.Value, error) { return "valuer wins", nil }

type unsignedValuer struct {
	calls *int
	value driver.Value
	err   error
}

func (v unsignedValuer) Value() (driver.Value, error) {
	*v.calls++
	return v.value, v.err
}

type nilValueReceiver string

func (v nilValueReceiver) Value() (driver.Value, error) { return string(v), nil }

type nilPointerReceiver struct{}

func (*nilPointerReceiver) Value() (driver.Value, error) { return uint64(math.MaxUint64), nil }

func TestUnsignedParametersReachProxyThroughDirectAndPreparedQueries(t *testing.T) {
	for _, prepared := range []bool{false, true} {
		t.Run(map[bool]string{false: "direct", true: "prepared"}[prepared], func(t *testing.T) {
			seen := make(chan *dbproxyv1.QueryRequest, 1)
			pool := openPool(t, func(req *dbproxyv1.QueryRequest, stream grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
				seen <- req
				return stream.Send(&dbproxyv1.QueryResponse{Columns: []*dbproxyv1.Column{{Name: "n", ValueType: dbproxyv1.ValueType_VALUE_TYPE_INT64}}})
			})
			large := uint64(math.MaxUint64)
			alias := unsignedAlias(math.MaxUint64)
			var nilAlias *unsignedAlias
			var nilValue *nilValueReceiver
			var nilPointer *nilPointerReceiver
			calls := 0
			args := []any{&large, alias, &alias, unsignedValuer{calls: &calls, value: large}, nilAlias, nilValue, nilPointer, uint64(7), unsignedAlias(7), uint(7), unsignedAliasValuer(math.MaxUint64)}
			if strconv.IntSize == 64 {
				args = append(args, uint(large))
			}
			ctx := sqldriver.WithQuery(context.Background(), "stacks-9", "test.unsigned")
			var rows interface{ Close() error }
			var err error
			if prepared {
				stmt, prepareErr := pool.PrepareContext(ctx, "SELECT ?")
				if prepareErr != nil {
					t.Fatal(prepareErr)
				}
				defer func() {
					if err := stmt.Close(); err != nil {
						t.Errorf("close stmt: %v", err)
					}
				}()
				rows, err = stmt.QueryContext(ctx, args...)
			} else {
				rows, err = pool.QueryContext(ctx, "SELECT ?", args...)
			}
			if err != nil {
				t.Fatal(err)
			}
			defer func() {
				if err := rows.Close(); err != nil {
					t.Errorf("close rows: %v", err)
				}
			}()
			if calls != 1 {
				t.Fatalf("Valuer calls = %d, want 1", calls)
			}
			params := (<-seen).Parameters
			if len(params) != len(args) {
				t.Fatalf("parameters = %d, want %d", len(params), len(args))
			}
			for _, i := range []int{0, 1, 2, 3, 6} {
				if _, ok := params[i].Kind.(*dbproxyv1.Value_Uint64Value); !ok || params[i].GetUint64Value() != math.MaxUint64 {
					t.Errorf("parameter %d = %v, want uint64 max", i, params[i])
				}
			}
			for _, i := range []int{4, 5} {
				if _, ok := params[i].Kind.(*dbproxyv1.Value_NullValue); !ok {
					t.Errorf("parameter %d = %v, want NULL", i, params[i])
				}
			}
			if params[7].GetUint64Value() != 7 || params[8].GetInt64Value() != 7 || params[9].GetInt64Value() != 7 {
				t.Errorf("ordinary unsigned parameters = %v", params[7:])
			}
			if params[10].GetStringValue() != "valuer wins" {
				t.Errorf("unsigned Valuer parameter = %v", params[10])
			}
			if strconv.IntSize == 64 && params[11].GetUint64Value() != math.MaxUint64 {
				t.Errorf("large uint parameter = %v", params[11])
			}
		})
	}
}

func TestInvalidValuerResultsFailBeforeProxyQuery(t *testing.T) {
	var attempts atomic.Int32
	pool := openPool(t, func(_ *dbproxyv1.QueryRequest, _ grpc.ServerStreamingServer[dbproxyv1.QueryResponse]) error {
		attempts.Add(1)
		return nil
	})
	ctx := sqldriver.WithQuery(context.Background(), "stacks-9", "test.invalid")
	sentinel := errors.New("valuer failed")
	for _, tc := range []struct {
		name  string
		value driver.Value
		err   error
	}{
		{name: "error", err: sentinel},
		{name: "invalid return", value: unsignedAlias(math.MaxUint64)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			_, err := pool.QueryContext(ctx, "SELECT ?", unsignedValuer{calls: &calls, value: tc.value, err: tc.err})
			if err == nil || (tc.err != nil && !errors.Is(err, tc.err)) || (tc.err == nil && !strings.Contains(err.Error(), "non-Value type")) {
				t.Fatalf("query error = %v", err)
			}
			if calls != 1 {
				t.Fatalf("Valuer calls = %d, want 1", calls)
			}
		})
	}
	if attempts.Load() != 0 {
		t.Fatalf("proxy attempts = %d, want 0", attempts.Load())
	}
}
