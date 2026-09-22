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
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

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
