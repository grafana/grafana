package app

import (
	"context"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
)

func TestGetQuota(t *testing.T) {
	t.Run("will return error when resource param is missing", func(t *testing.T) {
		clientMock := newMockQuotaClient(t)
		handler := NewQuotasHandler(&QuotasAppConfig{
			QuotaClient: clientMock,
		})
		url, err := url.Parse("http://localhost:3000/apis/quotas.grafana.app/v0alpha1/namespaces/stacks-1/usage?group=dashboard.grafana.app")
		require.NoError(t, err)
		req := &app.CustomRouteRequest{
			URL:    url,
			Method: "GET",
		}
		recorder := &httptest.ResponseRecorder{}
		err = handler.GetQuota(context.Background(), recorder, req)
		require.Error(t, err)
	})

	t.Run("will return error when group param is missing", func(t *testing.T) {
		clientMock := newMockQuotaClient(t)
		handler := NewQuotasHandler(&QuotasAppConfig{
			QuotaClient: clientMock,
		})
		url, err := url.Parse("http://localhost:3000/apis/quotas.grafana.app/v0alpha1/namespaces/stacks-1/usage?resource=dashboards")
		require.NoError(t, err)
		req := &app.CustomRouteRequest{
			URL:    url,
			Method: "GET",
		}
		recorder := &httptest.ResponseRecorder{}
		err = handler.GetQuota(context.Background(), recorder, req)
		require.Error(t, err)
	})

	t.Run("will return quotas response when params are valid", func(t *testing.T) {
		clientMock := newMockQuotaClient(t)
		clientMock.On("GetQuotaUsage", mock.Anything, mock.Anything).Return(&resourcepb.QuotaUsageResponse{
			Error: nil,
			Usage: 1,
			Limit: 2,
		}, nil)
		handler := NewQuotasHandler(&QuotasAppConfig{
			QuotaClient: clientMock,
		})
		url, err := url.Parse("http://localhost:3000/apis/quotas.grafana.app/v0alpha1/namespaces/stacks-1/usage?group=dashboard.grafana.app&resource=dashboards")
		require.NoError(t, err)
		req := &app.CustomRouteRequest{
			URL:    url,
			Method: "GET",
		}
		recorder := &httptest.ResponseRecorder{}
		err = handler.GetQuota(context.Background(), recorder, req)
		require.NoError(t, err)

		require.Equal(t, 200, recorder.Code)
	})
}

type mockQuotaClient struct {
	mock.Mock
}

func newMockQuotaClient(t *testing.T) *mockQuotaClient {
	t.Helper()
	client := &mockQuotaClient{}
	t.Cleanup(func() {
		client.AssertExpectations(t)
	})
	return client
}

func (m *mockQuotaClient) GetQuotaUsage(ctx context.Context, in *resourcepb.QuotaUsageRequest, opts ...grpc.CallOption) (*resourcepb.QuotaUsageResponse, error) {
	ret := m.Called(callArgs(ctx, in, opts)...)
	var resp *resourcepb.QuotaUsageResponse
	if ret.Get(0) != nil {
		resp = ret.Get(0).(*resourcepb.QuotaUsageResponse)
	}
	return resp, ret.Error(1)
}

func callArgs(ctx context.Context, in interface{}, opts []grpc.CallOption) []interface{} {
	args := []interface{}{ctx, in}
	for _, opt := range opts {
		args = append(args, opt)
	}
	return args
}
