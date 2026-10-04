package dashboard

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestValidateLibraryPanelDeleteSearchErrors(t *testing.T) {
	result := &resourcepb.ErrorResult{
		Code: http.StatusBadRequest, Reason: string(metav1.StatusReasonBadRequest), Message: "search field is not indexed",
	}
	grpcStatus, err := status.New(codes.Internal, "search failed").WithDetails(result)
	require.NoError(t, err)
	transportErr := errors.New("connection failed")

	for _, tc := range []struct {
		name     string
		response *resourcepb.ResourceSearchResponse
		err      error
	}{
		{name: "embedded", response: &resourcepb.ResourceSearchResponse{Error: result}},
		{name: "grpc details with nil response", err: grpcStatus.Err()},
		{name: "unrelated error", err: transportErr},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &recordingResourceClient{search: func(context.Context, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
				return tc.response, tc.err
			}}
			builder := &DashboardsAPIBuilder{unified: client}
			err := builder.validateLibraryPanelDelete(context.Background(), "panel-a", "stacks-1")
			if tc.err == transportErr {
				require.ErrorIs(t, err, transportErr)
				return
			}
			apiStatus, ok := err.(apierrors.APIStatus)
			require.True(t, ok, "expected direct APIStatus, got %T", err)
			require.Equal(t, metav1.Status{
				Status: metav1.StatusFailure, Code: result.Code, Reason: metav1.StatusReasonBadRequest, Message: result.Message,
			}, apiStatus.Status())
		})
	}
}
