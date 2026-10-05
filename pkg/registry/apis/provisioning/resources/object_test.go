package resources

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestResourceListerFromSearch_ListErrors(t *testing.T) {
	for _, tc := range resourceErrorCases(t) {
		t.Run(tc.name, func(t *testing.T) {
			store := resource.NewMockResourceClient(t)
			var response *resourcepb.ListManagedObjectsResponse
			if tc.result != nil {
				response = &resourcepb.ListManagedObjectsResponse{Error: tc.result}
			}
			store.EXPECT().ListManagedObjects(mock.Anything, mock.Anything).Return(response, tc.err).Once()
			got, err := NewResourceLister(store).List(context.Background(), "default", "repo")
			require.Nil(t, got)
			tc.assertError(t, err)
		})
	}
}

func TestResourceListerFromSearch_CountErrors(t *testing.T) {
	for _, tc := range resourceErrorCases(t) {
		t.Run(tc.name, func(t *testing.T) {
			store := resource.NewMockResourceClient(t)
			var response *resourcepb.CountManagedObjectsResponse
			if tc.result != nil {
				response = &resourcepb.CountManagedObjectsResponse{Error: tc.result}
			}
			store.EXPECT().CountManagedObjects(mock.Anything, mock.Anything).Return(response, tc.err).Once()
			got, err := NewResourceLister(store).Stats(context.Background(), "default", "")
			require.Nil(t, got)
			tc.assertError(t, err)
		})
	}
}

func TestResourceListerFromSearch_GetStatsErrors(t *testing.T) {
	for _, tc := range resourceErrorCases(t) {
		t.Run(tc.name, func(t *testing.T) {
			store := resource.NewMockResourceClient(t)
			store.EXPECT().CountManagedObjects(mock.Anything, mock.Anything).Return(&resourcepb.CountManagedObjectsResponse{}, nil).Once()
			var response *resourcepb.ResourceStatsResponse
			if tc.result != nil {
				response = &resourcepb.ResourceStatsResponse{Error: tc.result}
			}
			store.EXPECT().GetStats(mock.Anything, mock.Anything).Return(response, tc.err).Once()
			got, err := NewResourceLister(store).Stats(context.Background(), "default", "")
			require.Nil(t, got)
			tc.assertError(t, err)
		})
	}
}

type resourceErrorCase struct {
	name   string
	result *resourcepb.ErrorResult
	err    error
	want   metav1.Status
}

func resourceErrorCases(t *testing.T) []resourceErrorCase {
	t.Helper()
	result := &resourcepb.ErrorResult{Code: http.StatusNotFound, Reason: string(metav1.StatusReasonNotFound), Message: "not found"}
	st, err := status.New(codes.Internal, "outer error").WithDetails(result)
	require.NoError(t, err)
	want := resource.StatusError(result).(apierrors.APIStatus).Status()
	return []resourceErrorCase{
		{name: "embedded", result: result, want: want},
		{name: "grpc details", err: st.Err(), want: want},
	}
}

func (tc resourceErrorCase) assertError(t *testing.T, err error) {
	t.Helper()
	apiStatus, ok := err.(apierrors.APIStatus)
	require.True(t, ok, "API writers need an unwrapped APIStatus")
	require.Equal(t, tc.want, apiStatus.Status())
}
