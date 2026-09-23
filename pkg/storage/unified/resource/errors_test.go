package resource

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/testing/protocmp"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
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
					Reason: string(field.ErrorTypeNotFound),
					Field:  "field",
				},
			},
			RetryAfterSeconds: 12,
		},
		Code: http.StatusNotFound,
	}
	st, err := st.WithDetails(&errDetails)
	require.NoError(t, err)

	got := AsErrorResult(st.Err())

	// diff used as require.Equal has it's issues with Details.Causes
	diff := cmp.Diff(&errDetails, got, protocmp.Transform())
	require.Empty(t, diff)
}

func TestAsErrorResult_NamespaceMismatchIsForbidden(t *testing.T) {
	t.Parallel()

	// The guard fires inside the list transaction, so the sentinel reaches
	// AsErrorResult behind the transaction wrapper rather than on its own.
	transactional := fmt.Errorf("transactional operation: %w", claims.ErrNamespaceMismatch)

	for name, err := range map[string]error{
		"bare":    claims.ErrNamespaceMismatch,
		"wrapped": transactional,
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got := AsErrorResult(err)
			require.Equal(t, int32(http.StatusForbidden), got.Code, "an authorization outcome must not burn the 5xx error budget")
			require.Equal(t, string(metav1.StatusReasonForbidden), got.Reason)
			require.Equal(t, claims.ErrNamespaceMismatch.Error(), got.Message)
			require.True(t, apierrors.IsForbidden(GetError(got)), "callers should see a typed Forbidden error")
		})
	}
}

func TestErrorFromResponse(t *testing.T) {
	t.Parallel()

	detailsErr := func(code int32, msg string) error {
		st, err := status.New(codes.Internal, "wrapper").WithDetails(&resourcepb.ErrorResult{Code: code, Message: msg})
		require.NoError(t, err)
		return st.Err()
	}

	respErr := &resourcepb.ErrorResult{
		Code:    http.StatusNotFound,
		Reason:  string(metav1.StatusReasonNotFound),
		Message: "from response",
	}

	t.Run("success returns nil", func(t *testing.T) {
		t.Parallel()
		require.NoError(t, ErrorFromResponse(nil, nil))
	})

	t.Run("transport error is returned unchanged", func(t *testing.T) {
		t.Parallel()
		transportErr := status.Error(codes.Unavailable, "boom")
		got := ErrorFromResponse(nil, transportErr)
		require.ErrorIs(t, got, transportErr)
		require.Equal(t, codes.Unavailable, status.Code(got))
	})

	t.Run("cancellation stays detectable", func(t *testing.T) {
		t.Parallel()
		got := ErrorFromResponse(nil, fmt.Errorf("reading blob: %w", context.Canceled))
		require.ErrorIs(t, got, context.Canceled)
	})

	t.Run("transport error takes precedence over response result", func(t *testing.T) {
		t.Parallel()
		transportErr := status.Error(codes.Unavailable, "boom")
		require.ErrorIs(t, ErrorFromResponse(respErr, transportErr), transportErr)
	})

	t.Run("response-embedded result becomes a typed api error", func(t *testing.T) {
		t.Parallel()
		got := ErrorFromResponse(respErr, nil)
		require.True(t, apierrors.IsNotFound(got))
		require.Equal(t, "from response", got.Error())
	})

	t.Run("structured view is recoverable from either representation", func(t *testing.T) {
		t.Parallel()
		fromResponse := AsErrorResult(ErrorFromResponse(respErr, nil))
		require.Equal(t, respErr.Code, fromResponse.Code)
		require.Equal(t, respErr.Reason, fromResponse.Reason)

		fromDetails := AsErrorResult(ErrorFromResponse(respErr, detailsErr(http.StatusNotFound, "from details")))
		require.Equal(t, "from details", fromDetails.Message)
	})
}

func TestGRPCCodeFromErrorResult(t *testing.T) {
	t.Parallel()

	require.Equal(t, codes.OK, grpcCodeFromErrorResult(nil))
	require.Equal(t, codes.Internal, grpcCodeFromErrorResult(&resourcepb.ErrorResult{}))

	mapped := map[int32]codes.Code{
		http.StatusOK:                           codes.Internal,
		http.StatusGone:                         codes.OutOfRange,
		http.StatusRequestEntityTooLarge:        codes.InvalidArgument,
		http.StatusBadRequest:                   codes.InvalidArgument,
		http.StatusUnauthorized:                 codes.Unauthenticated,
		http.StatusForbidden:                    codes.PermissionDenied,
		http.StatusNotFound:                     codes.NotFound,
		http.StatusRequestTimeout:               codes.DeadlineExceeded,
		http.StatusConflict:                     codes.AlreadyExists,
		http.StatusPreconditionFailed:           codes.FailedPrecondition,
		http.StatusRequestedRangeNotSatisfiable: codes.OutOfRange,
		http.StatusUnprocessableEntity:          codes.InvalidArgument,
		http.StatusTooManyRequests:              codes.ResourceExhausted,
		http.StatusInternalServerError:          codes.Internal,
		http.StatusNotImplemented:               codes.Unimplemented,
		http.StatusServiceUnavailable:           codes.Unavailable,
		http.StatusGatewayTimeout:               codes.DeadlineExceeded,
		499:                                     codes.Canceled, // nginx's client-closed-request, what gRPC gateways emit for Canceled
	}
	for httpCode, want := range mapped {
		for _, reason := range []string{"", "error reading settings"} {
			require.Equal(t, want, grpcCodeFromErrorResult(&resourcepb.ErrorResult{Code: httpCode, Reason: reason}), "http status %d, reason %q", httpCode, reason)
		}
	}

	unmapped := map[int32]codes.Code{
		0:                           codes.Internal,
		-1:                          codes.Internal,
		http.StatusNoContent:        codes.Internal,
		http.StatusMovedPermanently: codes.Internal,
		http.StatusTeapot:           codes.InvalidArgument,
		498:                         codes.InvalidArgument,
		http.StatusBadGateway:       codes.Internal,
		599:                         codes.Internal,
		600:                         codes.Internal,
	}
	for httpCode, want := range unmapped {
		require.Equal(t, want, grpcCodeFromErrorResult(&resourcepb.ErrorResult{Code: httpCode}), "http status %d", httpCode)
	}

	reasons := []struct {
		code   int32
		reason metav1.StatusReason
		want   codes.Code
	}{
		{401, metav1.StatusReasonUnauthorized, codes.Unauthenticated},
		{403, metav1.StatusReasonForbidden, codes.PermissionDenied},
		{404, metav1.StatusReasonNotFound, codes.NotFound},
		{409, metav1.StatusReasonAlreadyExists, codes.AlreadyExists},
		{409, metav1.StatusReasonConflict, codes.Aborted},
		{410, metav1.StatusReasonGone, codes.OutOfRange},
		{410, metav1.StatusReasonExpired, codes.OutOfRange},
		{422, metav1.StatusReasonInvalid, codes.InvalidArgument},
		{400, metav1.StatusReasonBadRequest, codes.InvalidArgument},
		{406, metav1.StatusReasonNotAcceptable, codes.InvalidArgument},
		{415, metav1.StatusReasonUnsupportedMediaType, codes.InvalidArgument},
		{504, metav1.StatusReasonTimeout, codes.DeadlineExceeded},
		{500, metav1.StatusReasonServerTimeout, codes.Unavailable},
		{503, metav1.StatusReasonServiceUnavailable, codes.Unavailable},
		{429, metav1.StatusReasonTooManyRequests, codes.ResourceExhausted},
		{413, metav1.StatusReasonRequestEntityTooLarge, codes.InvalidArgument},
		{405, metav1.StatusReasonMethodNotAllowed, codes.Unimplemented},
		{500, metav1.StatusReasonInternalError, codes.Internal},
		{500, metav1.StatusReasonStoreReadError, codes.Internal},
	}
	for _, tt := range reasons {
		t.Run(string(tt.reason), func(t *testing.T) {
			for _, code := range []int32{tt.code, 0, http.StatusOK, http.StatusInternalServerError} {
				require.Equal(t, tt.want, grpcCodeFromErrorResult(&resourcepb.ErrorResult{Code: code, Reason: string(tt.reason)}), "http status %d", code)
			}
		})
	}
}

func TestIsConflict(t *testing.T) {
	t.Parallel()

	grpcConflict := status.New(codes.Aborted, "conflict")
	withDetails, err := grpcConflict.WithDetails(&resourcepb.ErrorResult{Code: http.StatusConflict, Message: "conflict"})
	require.NoError(t, err)

	withReasonOnly, err := status.New(codes.Aborted, "conflict").
		WithDetails(&resourcepb.ErrorResult{Reason: string(metav1.StatusReasonConflict), Message: "conflict"})
	require.NoError(t, err)

	withOtherDetails, err := status.New(codes.NotFound, "missing").
		WithDetails(&resourcepb.ErrorResult{Code: http.StatusNotFound, Reason: string(metav1.StatusReasonNotFound)})
	require.NoError(t, err)

	tests := map[string]struct {
		err      error
		expected bool
	}{
		"nil":                         {err: nil, expected: false},
		"typed conflict":              {err: apierrors.NewConflict(schema.GroupResource{Resource: "pods"}, "foo", nil), expected: true},
		"grpc status details":         {err: withDetails.Err(), expected: true},
		"grpc status reason only":     {err: withReasonOnly.Err(), expected: true},
		"grpc status no details":      {err: grpcConflict.Err(), expected: false},
		"grpc status other details":   {err: withOtherDetails.Err(), expected: false},
		"wrapped grpc status details": {err: fmt.Errorf("update failed: %w", withDetails.Err()), expected: true},
		"unrelated error":             {err: apierrors.NewBadRequest("nope"), expected: false},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, tc.expected, IsConflict(tc.err))
		})
	}
}

func TestStatusErrorFromResponse_NoErrorsReturnsNil(t *testing.T) {
	require.NoError(t, StatusErrorFromResponse(nil, nil))
}

func TestStatusErrorFromResponse_EmbeddedErrorPreservesStatus(t *testing.T) {
	responseError := &resourcepb.ErrorResult{
		Code:    http.StatusConflict,
		Reason:  string(metav1.StatusReasonConflict),
		Message: "dashboard was modified",
		Details: &resourcepb.ErrorDetails{
			Group: "dashboard.grafana.app",
			Kind:  "dashboards",
			Name:  "dashboard",
			Uid:   "uid",
			Causes: []*resourcepb.ErrorCause{
				{
					Reason:  "FieldValueInvalid",
					Field:   "metadata.resourceVersion",
					Message: "outdated version",
				},
			},
		},
	}

	err := StatusErrorFromResponse(responseError, nil)

	var apiStatus apierrors.APIStatus
	require.ErrorAs(t, err, &apiStatus)
	require.Equal(t, metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusConflict,
		Reason:  metav1.StatusReasonConflict,
		Message: "dashboard was modified",
		Details: &metav1.StatusDetails{
			Group: "dashboard.grafana.app",
			Kind:  "dashboards",
			Name:  "dashboard",
			UID:   "uid",
			Causes: []metav1.StatusCause{
				{
					Type:    metav1.CauseTypeFieldValueInvalid,
					Field:   "metadata.resourceVersion",
					Message: "outdated version",
				},
			},
		},
	}, apiStatus.Status())
}

func TestStatusErrorFromResponse_GRPCDetailsOverrideTransportStatus(t *testing.T) {
	grpcStatus, err := status.New(codes.Internal, "transport message").WithDetails(&resourcepb.ErrorResult{
		Code:    http.StatusTooManyRequests,
		Reason:  string(metav1.StatusReasonTooManyRequests),
		Message: "search is busy",
		Details: &resourcepb.ErrorDetails{RetryAfterSeconds: 12},
	})
	require.NoError(t, err)
	transportError := fmt.Errorf("handler: %w", fmt.Errorf("search: %w", grpcStatus.Err()))

	err = StatusErrorFromResponse(nil, transportError)

	var apiStatus apierrors.APIStatus
	require.ErrorAs(t, err, &apiStatus)
	require.Equal(t, metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusTooManyRequests,
		Reason:  metav1.StatusReasonTooManyRequests,
		Message: "search is busy",
		Details: &metav1.StatusDetails{RetryAfterSeconds: 12},
	}, apiStatus.Status())
}

func TestStatusErrorFromResponse_TransportErrorTakesPrecedenceOverResponseError(t *testing.T) {
	responseError := &resourcepb.ErrorResult{Code: http.StatusNotFound, Message: "missing dashboard"}
	transportError := status.Error(codes.Unavailable, "storage unavailable")

	err := StatusErrorFromResponse(responseError, transportError)

	var apiStatus apierrors.APIStatus
	require.ErrorAs(t, err, &apiStatus)
	require.Equal(t, int32(http.StatusServiceUnavailable), apiStatus.Status().Code)
	require.Contains(t, apiStatus.Status().Message, "storage unavailable")
}

func TestStatusErrorFromResponse_UnwrapsKubernetesStatusErrors(t *testing.T) {
	want := metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusNotFound,
		Reason:  metav1.StatusReasonNotFound,
		Message: "dashboard not found",
	}
	wrappedError := fmt.Errorf("search: %w", &apierrors.StatusError{ErrStatus: want})

	err := StatusErrorFromResponse(nil, wrappedError)

	var apiStatus apierrors.APIStatus
	require.ErrorAs(t, err, &apiStatus)
	require.Equal(t, want, apiStatus.Status())
}

func TestStatusErrorFromResponse_MapsGRPCCodesWithoutDetails(t *testing.T) {
	tests := []struct {
		grpcCode codes.Code
		httpCode int32
	}{
		{grpcCode: codes.NotFound, httpCode: http.StatusNotFound},
		{grpcCode: codes.Aborted, httpCode: http.StatusConflict},
		{grpcCode: codes.ResourceExhausted, httpCode: http.StatusTooManyRequests},
		{grpcCode: codes.Unavailable, httpCode: http.StatusServiceUnavailable},
		{grpcCode: codes.Canceled, httpCode: 499},
		{grpcCode: codes.DeadlineExceeded, httpCode: http.StatusGatewayTimeout},
	}
	for _, tc := range tests {
		t.Run(tc.grpcCode.String(), func(t *testing.T) {
			transportError := status.Error(tc.grpcCode, "request failed")

			err := StatusErrorFromResponse(nil, transportError)

			var apiStatus apierrors.APIStatus
			require.ErrorAs(t, err, &apiStatus)
			require.Equal(t, tc.httpCode, apiStatus.Status().Code)
		})
	}
}

func TestStatusErrorFromResponse_MapsContextErrors(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		httpCode int32
	}{
		{
			name:     "canceled",
			err:      context.Canceled,
			httpCode: 499,
		},
		{
			name:     "wrapped cancellation",
			err:      fmt.Errorf("search: %w", context.Canceled),
			httpCode: 499,
		},
		{
			name:     "deadline exceeded",
			err:      context.DeadlineExceeded,
			httpCode: http.StatusGatewayTimeout,
		},
		{
			name:     "wrapped deadline",
			err:      fmt.Errorf("search: %w", context.DeadlineExceeded),
			httpCode: http.StatusGatewayTimeout,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := StatusErrorFromResponse(nil, tc.err)

			var apiStatus apierrors.APIStatus
			require.ErrorAs(t, err, &apiStatus)
			require.Equal(t, tc.httpCode, apiStatus.Status().Code)
		})
	}
}

func TestStatusErrorFromResponse_UnknownErrorBecomesInternalServerError(t *testing.T) {
	err := StatusErrorFromResponse(nil, errors.New("unexpected failure"))

	var apiStatus apierrors.APIStatus
	require.ErrorAs(t, err, &apiStatus)
	require.Equal(t, int32(http.StatusInternalServerError), apiStatus.Status().Code)
	require.Equal(t, "unexpected failure", apiStatus.Status().Message)
}
