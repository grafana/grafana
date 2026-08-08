package grpc

import (
	"net/http"
	"testing"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestGRPCStatusFromErrorResult(t *testing.T) {
	t.Run("nil error result", func(t *testing.T) {
		require.NoError(t, GRPCStatusFromErrorResult(nil))
	})

	t.Run("carries the message", func(t *testing.T) {
		err := GRPCStatusFromErrorResult(&resourcepb.ErrorResult{
			Message: "boom",
			Code:    http.StatusNotFound,
		})
		st, ok := status.FromError(err)
		require.True(t, ok)
		require.Equal(t, codes.NotFound, st.Code())
		require.Equal(t, "boom", st.Message())
	})

	t.Run("OK produces no error", func(t *testing.T) {
		require.NoError(t, GRPCStatusFromErrorResult(&resourcepb.ErrorResult{Code: http.StatusOK}))
	})
}

func TestGRPCCodeFromHTTPStatus(t *testing.T) {
	tests := []struct {
		httpCode int32
		expected codes.Code
	}{
		{http.StatusOK, codes.OK},
		{http.StatusBadRequest, codes.InvalidArgument},
		{http.StatusUnauthorized, codes.Unauthenticated},
		{http.StatusForbidden, codes.PermissionDenied},
		{http.StatusNotFound, codes.NotFound},
		{http.StatusRequestTimeout, codes.DeadlineExceeded},
		{http.StatusConflict, codes.AlreadyExists},
		{http.StatusPreconditionFailed, codes.FailedPrecondition},
		{http.StatusRequestedRangeNotSatisfiable, codes.OutOfRange},
		{http.StatusUnprocessableEntity, codes.InvalidArgument},
		{http.StatusTooManyRequests, codes.ResourceExhausted},
		{statusClientClosedRequest, codes.Canceled},
		{http.StatusInternalServerError, codes.Internal},
		{http.StatusNotImplemented, codes.Unimplemented},
		{http.StatusServiceUnavailable, codes.Unavailable},
		{http.StatusGatewayTimeout, codes.DeadlineExceeded},
		// Unmapped statuses fall back by class.
		{http.StatusTeapot, codes.InvalidArgument},
		{http.StatusInsufficientStorage, codes.Internal},
		{http.StatusMovedPermanently, codes.Unknown},
		{0, codes.Unknown},
	}

	for _, tt := range tests {
		require.Equal(t, tt.expected, grpcCodeFromHTTPStatus(tt.httpCode),
			"http %d", tt.httpCode)
	}
}

// The HTTP status a gRPC code maps out to must map back to a code with the same
// HTTP status, otherwise a request crossing the boundary twice changes meaning.
func TestHTTPStatusRoundTrip(t *testing.T) {
	for code := codes.OK; code <= codes.Unauthenticated; code++ {
		httpCode := runtime.HTTPStatusFromCode(code)
		back := grpcCodeFromHTTPStatus(int32(httpCode))
		require.Equal(t, httpCode, runtime.HTTPStatusFromCode(back),
			"%s -> %d -> %s", code, httpCode, back)
	}
}
