package client

import (
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/stretchr/testify/require"
)

type MockDoer struct {
	Req *http.Request
}

func (doer *MockDoer) Do(req *http.Request) (*http.Response, error) {
	doer.Req = req
	return &http.Response{
		StatusCode: http.StatusOK,
		Status:     "200 OK",
	}, nil
}

func TestClient(t *testing.T) {
	t.Run("QueryResource", func(t *testing.T) {
		doer := &MockDoer{}
		// The method here does not really matter for resource calls
		client := NewClient(doer, http.MethodGet, "http://localhost:9090")

		t.Run("sends correct POST request", func(t *testing.T) {
			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "/api/v1/series",
				Method:        http.MethodPost,
				URL:           "/api/v1/series",
				Body:          []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"),
			}
			res, err := client.QueryResource(context.Background(), req)
			defer func() {
				if res != nil && res.Body != nil {
					if err := res.Body.Close(); err != nil {
						logger.Warn("Error", "err", err)
					}
				}
			}()
			require.NoError(t, err)
			require.NotNil(t, doer.Req)
			require.Equal(t, http.MethodPost, doer.Req.Method)
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"), body)
			require.Equal(t, "http://localhost:9090/api/v1/series", doer.Req.URL.String())
		})

		t.Run("sends correct GET request", func(t *testing.T) {
			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "/api/v1/series",
				Method:        http.MethodGet,
				URL:           "api/v1/series?match%5B%5D=ALERTS&start=1655272558&end=1655294158",
			}
			res, err := client.QueryResource(context.Background(), req)
			defer func() {
				if res != nil && res.Body != nil {
					if err := res.Body.Close(); err != nil {
						logger.Warn("Error", "err", err)
					}
				}
			}()
			require.NoError(t, err)
			require.NotNil(t, doer.Req)
			require.Equal(t, http.MethodGet, doer.Req.Method)
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte{}, body)
			require.Equal(t, "http://localhost:9090/api/v1/series?match%5B%5D=ALERTS&start=1655272558&end=1655294158", doer.Req.URL.String())
		})
	})
}
