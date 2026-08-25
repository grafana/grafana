package resource

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/testing/protocmp"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
		Code: int32(codes.NotFound),
	}
	st, err := st.WithDetails(&errDetails)
	require.NoError(t, err)

	got := AsErrorResult(st.Err())

	// diff used as require.Equal has it's issues with Details.Causes
	diff := cmp.Diff(&errDetails, got, protocmp.Transform())
	require.Empty(t, diff)
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
