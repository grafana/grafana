package resources

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

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
			got, err := NewResourceLister(store, nil).List(context.Background(), "default", "repo")
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
			got, err := NewResourceLister(store, nil).Stats(context.Background(), "default", "")
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
			got, err := NewResourceLister(store, nil).Stats(context.Background(), "default", "")
			require.Nil(t, got)
			tc.assertError(t, err)
		})
	}
}

func TestResourceListerFromSearch_Kinds(t *testing.T) {
	clients := NewMockResourceClients(t)
	clients.EXPECT().Kinds(mock.Anything).
		Return(map[schema.GroupResource]string{{Group: "dashboard.grafana.app", Resource: "dashboards"}: "Dashboard"}, nil).Times(2)
	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Times(2)

	store := resource.NewMockResourceClient(t)
	store.EXPECT().ListManagedObjects(mock.Anything, mock.Anything).Return(&resourcepb.ListManagedObjectsResponse{
		Items: []*resourcepb.ListManagedObjectsResponse_Item{
			{Object: &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "a"}},
			{Object: &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "b"}},
			{Object: &resourcepb.ResourceKey{Group: "example.ext.grafana.app", Resource: "widgets", Name: "c"}},
		},
	}, nil).Once()
	store.EXPECT().CountManagedObjects(mock.Anything, mock.Anything).Return(&resourcepb.CountManagedObjectsResponse{
		Items: []*resourcepb.CountManagedObjectsResponse_ResourceCount{
			{Kind: "repo", Id: "repo", Group: "dashboard.grafana.app", Resource: "dashboards", Count: 2},
		},
	}, nil).Once()

	lister := NewResourceLister(store, factory)
	list, err := lister.List(context.Background(), "default", "repo")
	require.NoError(t, err)
	require.Equal(t, []string{"Dashboard", "Dashboard", ""}, []string{list.Items[0].Kind, list.Items[1].Kind, list.Items[2].Kind})

	stats, err := lister.Stats(context.Background(), "default", "repo")
	require.NoError(t, err)
	require.Equal(t, "Dashboard", stats.Managed[0].Stats[0].Kind)
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
		{name: "grpc details", err: st.Err()},
		{name: "wrapped grpc", err: fmt.Errorf("storage: %w", st.Err())},
		{name: "unstructured grpc", err: status.Error(codes.Unavailable, "backend connection failed")},
		{name: "ordinary transport", err: errors.New("transport failed")},
	}
}

func (tc resourceErrorCase) assertError(t *testing.T, err error) {
	t.Helper()
	if tc.err != nil {
		require.Same(t, tc.err, err)
		return
	}
	apiStatus, ok := err.(apierrors.APIStatus)
	require.True(t, ok)
	require.Equal(t, tc.want, apiStatus.Status())
}
