package common

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestSearchStatusError(t *testing.T) {
	for _, code := range []codes.Code{codes.Internal, codes.Unavailable, codes.DeadlineExceeded} {
		t.Run(code.String(), func(t *testing.T) {
			transportErr := status.Error(code, "private database failure")
			err := SearchStatusError(nil, fmt.Errorf("search: %w", transportErr))
			require.ErrorIs(t, err, transportErr)
			var apiStatus apierrors.APIStatus
			require.ErrorAs(t, err, &apiStatus)
			got := apiStatus.Status()
			require.Equal(t, http.StatusText(int(got.Code)), got.Message)
			require.NotContains(t, got.Message, "private database failure")
			require.NotContains(t, err.Error(), "private database failure")
		})
	}

	t.Run("structured server error", func(t *testing.T) {
		failure := &resourcepb.ErrorResult{Code: http.StatusServiceUnavailable, Message: "index unavailable"}
		st, err := status.New(codes.Unavailable, "transport message").WithDetails(failure)
		require.NoError(t, err)
		got := SearchStatusError(nil, st.Err())
		var apiStatus apierrors.APIStatus
		require.ErrorAs(t, got, &apiStatus)
		require.Equal(t, failure.Message, apiStatus.Status().Message)
	})

	t.Run("unstructured client error", func(t *testing.T) {
		got := SearchStatusError(nil, status.Error(codes.InvalidArgument, "invalid filter"))
		var apiStatus apierrors.APIStatus
		require.ErrorAs(t, got, &apiStatus)
		require.Contains(t, apiStatus.Status().Message, "invalid filter")
	})

	t.Run("plain error", func(t *testing.T) {
		plain := errors.New("private database failure")
		require.ErrorIs(t, SearchStatusError(nil, plain), plain)
	})
}
