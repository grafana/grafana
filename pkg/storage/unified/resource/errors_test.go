package resource

import (
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/testing/protocmp"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func TestErrResourceAlreadyExistsIsRecognisable(t *testing.T) {
	t.Parallel()

	require.True(t, apierrors.IsAlreadyExists(ErrResourceAlreadyExists), "ErrResourceAlreadyExists should be recognised as an AlreadyExists error")
}

func TestAsErrorResult_UnpackCorrectErrorDetails(t *testing.T) {
	st := status.New(codes.Aborted, "concurrent create")
	errDetails := resourcepb.ErrorResult{
		Message: "message",
		Reason:  "reason",
		Details: &resourcepb.ErrorDetails{
			Name:  "name",
			Group: "group",
			Kind:  "kind",
			Uid:   "uid",
			Causes: []*resourcepb.ErrorCause{
				{
					Reason: string(field.ErrorTypeForbidden),
					Field:  "field",
				},
			},
			RetryAfterSeconds: 12,
		},
		Code: 12,
	}
	st, err := st.WithDetails(&errDetails)
	require.NoError(t, err)

	got := AsErrorResult(st.Err())

	// diff used as require.Equal has it's issues with Details.Causes
	diff := cmp.Diff(&errDetails, got, protocmp.Transform())
	require.Empty(t, diff)
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
