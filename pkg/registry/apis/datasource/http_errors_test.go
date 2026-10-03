package datasource

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func TestRequestErrorStatus(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		code int32
	}{
		{"invalid request", errors.New("invalid JSON"), http.StatusBadRequest},
		{"body limit", fmt.Errorf("read: %w", &http.MaxBytesError{Limit: 10}), http.StatusRequestEntityTooLarge},
		{"deadline", fmt.Errorf("read: %w", context.DeadlineExceeded), http.StatusGatewayTimeout},
		{"existing status", fmt.Errorf("read: %w", apierrors.NewTooManyRequests("busy", 1)), http.StatusTooManyRequests},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var status apierrors.APIStatus
			require.ErrorAs(t, RequestError(tc.err), &status)
			require.Equal(t, tc.code, status.Status().Code)
		})
	}
}

func TestResourceRequestInvalidPath(t *testing.T) {
	_, err := resourceRequest(httptest.NewRequest(http.MethodGet, "/not-a-resource", nil), "ds")
	require.True(t, apierrors.IsBadRequest(err))
}

type missingHTTPDatasourceProvider struct{ mockDatasources }

func (missingHTTPDatasourceProvider) GetDataSource(context.Context, string) (*dsV0.DataSource, error) {
	return nil, fmt.Errorf("lookup: %w", datasources.ErrDataSourceNotFound)
}

func TestHTTPGetMissingDatasource(t *testing.T) {
	h := NewHTTPHandlers(HTTPHandlerOptions{
		Group:       "prometheus.datasource.grafana.app",
		Datasources: missingHTTPDatasourceProvider{},
	})
	r := httptest.NewRequest(http.MethodGet, "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/stacks-11/datasources/missing", nil)
	r.SetPathValue("uid", "missing")
	w := httptest.NewRecorder()
	h.Get(w, r)
	require.Equal(t, http.StatusNotFound, w.Code, w.Body.String())
}

func TestConversionPreservesErrorStatus(t *testing.T) {
	client := httpConversionFunc(func(context.Context, *backend.ConversionRequest) (*backend.ConversionResponse, error) {
		return &backend.ConversionResponse{Result: &backend.StatusResult{Message: "conversion rejected"}},
			fmt.Errorf("plugin: %w", apierrors.NewBadRequest("invalid query"))
	})
	r := httptest.NewRequest(http.MethodPost, "/queryconvert", strings.NewReader(httpQueryBody))
	r.Header.Set("Content-Type", "application/json")
	_, err := convertQueryDataRequest(r.Context(), r, client, mockContextProvider{})
	require.True(t, apierrors.IsBadRequest(err), "%v", err)
	var status apierrors.APIStatus
	require.ErrorAs(t, err, &status)
	require.Equal(t, int32(http.StatusBadRequest), status.Status().Code)
}
