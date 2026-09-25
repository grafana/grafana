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
		clientMock := newMockQuotasClient(t)
		handler := NewQuotasHandler(&QuotasAppConfig{
			ResourceClient: clientMock,
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
		clientMock := newMockQuotasClient(t)
		handler := NewQuotasHandler(&QuotasAppConfig{
			ResourceClient: clientMock,
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
		clientMock := newMockQuotasClient(t)
		clientMock.On("GetQuotaUsage", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.QuotaUsageResponse{
			Error: nil,
			Usage: 1,
			Limit: 2,
		}, nil)
		handler := NewQuotasHandler(&QuotasAppConfig{
			ResourceClient: clientMock,
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

type mockQuotasClient struct {
	mock.Mock
}

func newMockQuotasClient(t *testing.T) *mockQuotasClient {
	m := &mockQuotasClient{}
	m.Test(t)
	t.Cleanup(func() { m.AssertExpectations(t) })
	return m
}

func (m *mockQuotasClient) GetQuotaUsage(ctx context.Context, in *resourcepb.QuotaUsageRequest, opts ...grpc.CallOption) (*resourcepb.QuotaUsageResponse, error) {
	args := m.Called(ctx, in, opts)
	return args.Get(0).(*resourcepb.QuotaUsageResponse), args.Error(1)
}
