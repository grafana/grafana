package app

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestGetQuotaResponses(t *testing.T) {
	result := &resourcepb.ErrorResult{
		Code: http.StatusServiceUnavailable, Reason: "ServiceUnavailable", Message: "quota unavailable",
		Details: &resourcepb.ErrorDetails{
			Name: "quota", Group: "dashboard.grafana.app", Kind: "dashboards", Uid: "quota-uid",
			RetryAfterSeconds: 3,
			Causes:            []*resourcepb.ErrorCause{{Reason: "FieldValueInvalid", Message: "invalid resource", Field: "resource"}},
		},
	}
	grpcStatus, err := status.New(codes.Internal, "transport message").WithDetails(result)
	require.NoError(t, err)
	embedded := &resourcepb.QuotaUsageResponse{Error: result, Usage: 10, Limit: 20}
	transportErr := errors.New("connection failed")
	const errorBody = `{
		"metadata":{}, "status":"Failure", "code":503, "reason":"ServiceUnavailable", "message":"quota unavailable",
		"details":{"name":"quota","group":"dashboard.grafana.app","kind":"dashboards","uid":"quota-uid",
			"retryAfterSeconds":3,"causes":[{"reason":"FieldValueInvalid","message":"invalid resource","field":"resource"}]}
	}`
	for _, tc := range []struct {
		name     string
		response *resourcepb.QuotaUsageResponse
		err      error
		code     int
		body     string
		wantErr  string
	}{
		{name: "embedded", response: embedded, code: http.StatusServiceUnavailable, body: errorBody},
		{name: "grpc", err: grpcStatus.Err(), code: http.StatusServiceUnavailable, body: errorBody},
		{name: "transport takes precedence", response: embedded, err: transportErr, wantErr: transportErr.Error()},
		{
			name: "unstructured grpc", err: status.Error(codes.Unavailable, "private database failure"),
			code: http.StatusServiceUnavailable, body: `{"metadata":{},"status":"Failure","code":503,"message":"Service Unavailable"}`,
		},
		{name: "nil response", wantErr: "GetQuotaUsage returned a nil response"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder, err := callGetQuota(t, tc.response, tc.err)
			if tc.wantErr != "" {
				require.EqualError(t, err, tc.wantErr)
				if tc.err != nil {
					require.Same(t, tc.err, err)
				}
				require.Empty(t, recorder.Body.String())
				require.Empty(t, recorder.Header())
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.code, recorder.Code)
			require.Equal(t, "application/json", recorder.Header().Get("Content-Type"))
			require.JSONEq(t, tc.body, recorder.Body.String())
		})
	}
}

func callGetQuota(t *testing.T, response *resourcepb.QuotaUsageResponse, callErr error) (*httptest.ResponseRecorder, error) {
	t.Helper()
	client := newMockQuotasClient(t)
	client.On("GetQuotaUsage", mock.Anything, &resourcepb.QuotaUsageRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "stacks-1",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
		},
	}, mock.Anything).Return(response, callErr).Once()
	handler := NewQuotasHandler(&QuotasAppConfig{ResourceClient: client})
	request := httptest.NewRequest(http.MethodGet, "/usage?group=dashboard.grafana.app&resource=dashboards", nil)
	recorder := httptest.NewRecorder()
	err := handler.GetQuota(context.Background(), recorder, &app.CustomRouteRequest{
		URL:                request.URL,
		Method:             request.Method,
		ResourceIdentifier: resource.FullIdentifier{Namespace: "stacks-1"},
	})
	return recorder, err
}
