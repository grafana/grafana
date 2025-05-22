package client

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/promlib/models"
)

type MockDoer struct {
	Req            *http.Request
	ResponseStatus int
	ResponseError  error
	RequestCount   int
	NextStatus     int
}

func (doer *MockDoer) Do(req *http.Request) (*http.Response, error) {
	doer.Req = req
	doer.RequestCount++

	if doer.NextStatus != 0 && doer.RequestCount > 1 {
		status := doer.NextStatus
		doer.NextStatus = 0
		return &http.Response{
			StatusCode: status,
			Status:     fmt.Sprintf("%d Status", status),
			Body:       io.NopCloser(nil),
		}, nil
	}

	if doer.ResponseStatus != 0 {
		return &http.Response{
			StatusCode: doer.ResponseStatus,
			Status:     fmt.Sprintf("%d Status", doer.ResponseStatus),
			Body:       io.NopCloser(nil),
		}, doer.ResponseError
	}

	return &http.Response{
		StatusCode: http.StatusOK,
		Status:     "200 OK",
		Body:       io.NopCloser(nil),
	}, nil
}

func TestClient(t *testing.T) {
	t.Run("QueryResource", func(t *testing.T) {
		t.Run("sends correct POST request", func(t *testing.T) {
			doer := &MockDoer{}
			client := NewClient(doer, http.MethodGet, "http://localhost:9090", "60s")

			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "api/v1/series",
				Method:        http.MethodPost,
				URL:           "/api/v1/series",
				Body:          []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"),
			}
			res, err := client.QueryResource(context.Background(), req)
			defer func() {
				if res != nil && res.Body != nil {
					if err := res.Body.Close(); err != nil {
						fmt.Println("Error", "err", err)
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
			doer := &MockDoer{}
			client := NewClient(doer, http.MethodGet, "http://localhost:9090", "60s")

			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "api/v1/label/label_key/values",
				Method:        http.MethodPost,
				URL:           "api/v1/label/label_key/values?match%5B%5D=ALERTS&start=1655272558&end=1655294158",
			}
			res, err := client.QueryResource(context.Background(), req)
			defer func() {
				if res != nil && res.Body != nil {
					if err := res.Body.Close(); err != nil {
						fmt.Println("Error", "err", err)
					}
				}
			}()
			require.NoError(t, err)
			require.NotNil(t, doer.Req)
			require.Equal(t, http.MethodGet, doer.Req.Method)
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte{}, body)
			require.Equal(t, "http://localhost:9090/api/v1/label/label_key/values?match%5B%5D=ALERTS&start=1655272558&end=1655294158", doer.Req.URL.String())
		})

		t.Run("forces GET for endpoints that only support GET", func(t *testing.T) {
			doer := &MockDoer{}
			client := NewClient(doer, http.MethodPost, "http://localhost:9090", "60s")

			// Testing api/v1/metadata which is in the endpointsSupportOnlyGet list
			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "api/v1/metadata",
				Method:        http.MethodPost, // This should be ignored and GET used instead
				URL:           "api/v1/metadata",
				Body:          []byte("param1=value1&param2=value2"),
			}
			res, err := client.QueryResource(context.Background(), req)
			defer func() {
				if res != nil && res.Body != nil {
					if err := res.Body.Close(); err != nil {
						fmt.Println("Error", "err", err)
					}
				}
			}()
			require.NoError(t, err)
			require.NotNil(t, doer.Req)

			// Verify GET is used instead of POST
			require.Equal(t, http.MethodGet, doer.Req.Method)

			// Verify body params were moved to URL
			require.Equal(t, "http://localhost:9090/api/v1/metadata?param1=value1&param2=value2", doer.Req.URL.String())

			// Verify body is empty
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte{}, body)
		})

		t.Run("moves body params to URL for GET requests", func(t *testing.T) {
			doer := &MockDoer{}
			client := NewClient(doer, http.MethodGet, "http://localhost:9090", "60s")

			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "api/v1/label/job/values",
				Method:        http.MethodGet,
				URL:           "api/v1/label/job/values?existing=param",
				Body:          []byte("match[]=metric{label=\"value\"}&start=1234&end=5678"),
			}
			res, err := client.QueryResource(context.Background(), req)
			defer func() {
				if res != nil && res.Body != nil {
					if err := res.Body.Close(); err != nil {
						fmt.Println("Error", "err", err)
					}
				}
			}()
			require.NoError(t, err)
			require.NotNil(t, doer.Req)

			// Verify GET is used
			require.Equal(t, http.MethodGet, doer.Req.Method)

			// Verify existing URL params are preserved and body params are added
			require.Contains(t, doer.Req.URL.String(), "existing=param")
			require.Contains(t, doer.Req.URL.String(), "match%5B%5D=metric%7Blabel%3D%22value%22%7D")
			require.Contains(t, doer.Req.URL.String(), "start=1234")
			require.Contains(t, doer.Req.URL.String(), "end=5678")

			// Verify body is empty
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte{}, body)
		})

		t.Run("falls back to GET when POST returns 405 Method Not Allowed", func(t *testing.T) {
			doer := &MockDoer{
				ResponseStatus: http.StatusMethodNotAllowed,
				ResponseError:  nil,
				NextStatus:     http.StatusOK,
			}
			client := NewClient(doer, http.MethodPost, "http://localhost:9090", "60s")

			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "api/v1/query",
				Method:        http.MethodPost,
				URL:           "api/v1/query",
				Body:          []byte("query=up&time=1234"),
			}
			res, err := client.QueryResource(context.Background(), req)
			defer func() {
				if res != nil && res.Body != nil {
					if err := res.Body.Close(); err != nil {
						fmt.Println("Error", "err", err)
					}
				}
			}()
			require.NoError(t, err)
			require.NotNil(t, doer.Req)

			// Verify two requests were made (POST first, then GET)
			require.Equal(t, 2, doer.RequestCount)

			// The last request should be GET
			require.Equal(t, http.MethodGet, doer.Req.Method)

			// Verify URL contains the body params
			require.Equal(t, "http://localhost:9090/api/v1/query?query=up&time=1234", doer.Req.URL.String())

			// Verify body is empty
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte{}, body)
		})

		t.Run("falls back to GET when POST returns 400 Bad Request", func(t *testing.T) {
			doer := &MockDoer{
				ResponseStatus: http.StatusBadRequest,
				ResponseError:  nil,
				NextStatus:     http.StatusOK,
			}
			client := NewClient(doer, http.MethodPost, "http://localhost:9090", "60s")

			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "api/v1/query",
				Method:        http.MethodPost,
				URL:           "api/v1/query",
				Body:          []byte("query=up&time=1234"),
			}
			res, err := client.QueryResource(context.Background(), req)
			defer func() {
				if res != nil && res.Body != nil {
					if err := res.Body.Close(); err != nil {
						fmt.Println("Error", "err", err)
					}
				}
			}()
			require.NoError(t, err)
			require.NotNil(t, doer.Req)

			// Verify two requests were made (POST first, then GET)
			require.Equal(t, 2, doer.RequestCount)

			// The last request should be GET
			require.Equal(t, http.MethodGet, doer.Req.Method)

			// Verify URL contains the body params
			require.Equal(t, "http://localhost:9090/api/v1/query?query=up&time=1234", doer.Req.URL.String())

			// Verify body is empty
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte{}, body)
		})
	})

	t.Run("QueryRange", func(t *testing.T) {
		t.Run("sends correct POST query", func(t *testing.T) {
			doer := &MockDoer{}
			client := NewClient(doer, http.MethodPost, "http://localhost:9090", "60s")
			req := &models.Query{
				Expr:       "rate(ALERTS{job=\"test\" [$__rate_interval]})",
				Start:      time.Unix(0, 0),
				End:        time.Unix(1234, 0),
				RangeQuery: true,
				Step:       1 * time.Second,
			}
			res, err := client.QueryRange(context.Background(), req)
			defer func() {
				if res != nil && res.Body != nil {
					if err := res.Body.Close(); err != nil {
						fmt.Println("Error", "err", err)
					}
				}
			}()
			require.NoError(t, err)
			require.NotNil(t, doer.Req)
			require.Equal(t, http.MethodPost, doer.Req.Method)
			require.Equal(t, "application/x-www-form-urlencoded", doer.Req.Header.Get("Content-Type"))
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte("end=1234&query=rate%28ALERTS%7Bjob%3D%22test%22+%5B%24__rate_interval%5D%7D%29&start=0&step=1&timeout=60s"), body)
			require.Equal(t, "http://localhost:9090/api/v1/query_range", doer.Req.URL.String())
		})

		t.Run("sends correct GET query", func(t *testing.T) {
			doer := &MockDoer{}
			client := NewClient(doer, http.MethodGet, "http://localhost:9090", "60s")
			req := &models.Query{
				Expr:       "rate(ALERTS{job=\"test\" [$__rate_interval]})",
				Start:      time.Unix(0, 0),
				End:        time.Unix(1234, 0),
				RangeQuery: true,
				Step:       1 * time.Second,
			}
			res, err := client.QueryRange(context.Background(), req)
			defer func() {
				if res != nil && res.Body != nil {
					if err := res.Body.Close(); err != nil {
						fmt.Println("Error", "err", err)
					}
				}
			}()
			require.NoError(t, err)
			require.NotNil(t, doer.Req)
			require.Equal(t, http.MethodGet, doer.Req.Method)
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte{}, body)
			require.Equal(t, "http://localhost:9090/api/v1/query_range?end=1234&query=rate%28ALERTS%7Bjob%3D%22test%22+%5B%24__rate_interval%5D%7D%29&start=0&step=1&timeout=60s", doer.Req.URL.String())
		})
	})
}
