package dashboard

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

func TestValidateLibraryPanelDeleteSearchErrors(t *testing.T) {
	badRequest := &resourcepb.ErrorResult{
		Code: http.StatusBadRequest, Reason: string(metav1.StatusReasonBadRequest), Message: "search field is not indexed",
	}
	badRequestStatus, err := status.New(codes.Internal, "search failed").WithDetails(badRequest)
	require.NoError(t, err)
	forbidden := &resourcepb.ErrorResult{
		Code: http.StatusForbidden, Reason: string(metav1.StatusReasonForbidden), Message: "search denied",
	}
	forbiddenStatus, err := status.New(codes.PermissionDenied, forbidden.Message).WithDetails(forbidden)
	require.NoError(t, err)
	transportErr := errors.New("connection failed")

	for _, tc := range []struct {
		name     string
		response *resourcepb.ResourceSearchResponse
		err      error
		want     *resourcepb.ErrorResult
	}{
		{name: "grpc details with nil response", err: badRequestStatus.Err(), want: badRequest},
		{name: "wrapped grpc details", err: fmt.Errorf("search: %w", badRequestStatus.Err()), want: badRequest},
		// A failed reference search must not read as "no references" and allow the delete.
		{name: "permission denied with empty response", response: &resourcepb.ResourceSearchResponse{}, err: forbiddenStatus.Err(), want: forbidden},
		{name: "unrelated error", err: transportErr},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &recordingResourceClient{search: func(context.Context, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
				return tc.response, tc.err
			}}
			builder := &DashboardsAPIBuilder{unified: client}
			err := builder.validateLibraryPanelDelete(context.Background(), "panel-a", "stacks-1")
			if tc.want == nil {
				require.ErrorIs(t, err, transportErr)
				return
			}
			apiStatus, ok := err.(apierrors.APIStatus)
			require.True(t, ok, "expected direct APIStatus, got %T", err)
			require.Equal(t, metav1.Status{
				Status: metav1.StatusFailure, Code: tc.want.Code, Reason: metav1.StatusReason(tc.want.Reason), Message: tc.want.Message,
			}, apiStatus.Status())
		})
	}
}
