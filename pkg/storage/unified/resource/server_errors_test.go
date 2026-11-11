package resource

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/storage/unified/resourceclient/resourceutil"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// requireRPCError asserts that err is the gRPC status a handler returns for
// want: the mapped code and want attached as the ErrorResult detail.
func requireRPCError(t testing.TB, err error, want *resourcepb.ErrorResult) {
	t.Helper()
	got := rpcErrorResult(t, err)
	require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
}

// rpcErrorResult asserts that err is a gRPC status carrying an ErrorResult
// detail and returns it.
func rpcErrorResult(t testing.TB, err error) *resourcepb.ErrorResult {
	t.Helper()
	require.Error(t, err)
	res := resourceutil.ErrorResultFromGRPCDetails(err)
	require.NotNil(t, res, "expected an ErrorResult detail on %v", err)
	require.Equal(t, grpcCodeFromErrorResult(res), status.Code(err))
	return res
}

func TestRPCErrorFrom(t *testing.T) {
	require.NoError(t, rpcErrorFrom(nil))

	t.Run("gRPC status is returned unchanged", func(t *testing.T) {
		plain := status.Error(codes.Unavailable, "down")
		require.Same(t, plain, rpcErrorFrom(plain))

		notFound := NewNotFoundError(&resourcepb.ResourceKey{Resource: "dashboards", Name: "a"})
		detailed := GRPCStatusError(notFound)
		require.Same(t, detailed, rpcErrorFrom(detailed))

		wrapped := fmt.Errorf("context: %w", detailed)
		require.Same(t, wrapped, rpcErrorFrom(wrapped))
		requireRPCError(t, rpcErrorFrom(wrapped), notFound)
	})

	t.Run("API status keeps its reason and details", func(t *testing.T) {
		err := rpcErrorFrom(NewConflictStatusError("g", "r", "n", "changed"))
		require.Equal(t, codes.Aborted, status.Code(err))
		res := rpcErrorResult(t, err)
		require.Equal(t, int32(http.StatusConflict), res.Code)
		require.Equal(t, string(metav1.StatusReasonConflict), res.Reason)
		require.Equal(t, "n", res.Details.GetName())
	})

	t.Run("plain errors become internal errors", func(t *testing.T) {
		err := rpcErrorFrom(errors.New("boom"))
		requireRPCError(t, err, &resourcepb.ErrorResult{Message: "boom", Code: http.StatusInternalServerError})
		require.Equal(t, codes.Internal, status.Code(err))
	})

	t.Run("context cancellation becomes canceled", func(t *testing.T) {
		require.Equal(t, codes.Canceled, status.Code(rpcErrorFrom(context.Canceled)))
	})

	// A storage failure joined with a cancelled call must not be hidden from
	// error budgets as a client cancellation.
	t.Run("storage failure joined with a canceled status stays internal", func(t *testing.T) {
		err := rpcErrorFrom(errors.Join(errors.New("storage failed"), status.Error(codes.Canceled, "canceled")))
		require.Equal(t, codes.Internal, status.Code(err))
		require.Equal(t, int32(http.StatusInternalServerError), rpcErrorResult(t, err).Code)
	})

	t.Run("joined cancellations stay canceled", func(t *testing.T) {
		joined := errors.Join(status.Error(codes.Canceled, "a"), context.Canceled)
		require.Same(t, joined, rpcErrorFrom(joined))
	})
}
