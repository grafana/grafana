package apistore

import (
	"context"
	"errors"
	"net/http"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type preparationSearchIndex struct {
	resourcepb.ResourceIndexClient
	response *resourcepb.ResourceSearchResponse
	err      error
}

func (f *preparationSearchIndex) Search(context.Context, *resourcepb.ResourceSearchRequest, ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	return f.response, f.err
}

func TestPrepareObjectForStorageSearchErrors(t *testing.T) {
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
			s := &Storage{
				gr:         dashv1.DashboardResourceInfo.GroupResource(),
				serializer: &jsonSerializer{},
				opts: StorageOptions{
					GVK:                  dashv1.DashboardResourceInfo.GroupVersionKind(),
					DeprecatedInternalID: DeprecatedID_Required,
					Index:                &preparationSearchIndex{response: tc.response, err: tc.err},
				},
			}
			ctx := authlib.WithAuthInfo(context.Background(),
				&identity.StaticRequester{UserID: 1, UserUID: "user-uid", Type: authlib.TypeUser})
			dash := &dashv1.Dashboard{Name: "dash-a", Namespace: "stacks-1"}
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)
			meta.SetDeprecatedInternalID(42) // nolint:staticcheck

			prepared, err := s.prepareObjectForStorage(ctx, dash)
			require.Empty(t, prepared.raw)
			if errors.Is(tc.err, transportErr) {
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
