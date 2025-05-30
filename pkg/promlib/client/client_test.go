package client

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
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

func urlMustUnescape(t *testing.T, s string) string {
	decoded, err := url.QueryUnescape(s)
	require.NoError(t, err)
	return decoded
}

func mustCloseResponse(t *testing.T) func(res *http.Response) {
	return func(res *http.Response) {
		if res != nil && res.Body != nil {
			require.NoError(t, res.Body.Close())
		}
	}
}

func TestClient(t *testing.T) {
	t.Run("QueryResource", func(t *testing.T) {
		t.Run("sends correct POST request", func(t *testing.T) {
			doer := &MockDoer{}
			client := NewClient(doer, http.MethodPost, "http://localhost:9090", "60s")

			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "api/v1/series",
				Method:        http.MethodPost,
				URL:           "/api/v1/series",
				Body:          []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"),
			}
			res, err := client.QueryResource(context.Background(), req)
			defer mustCloseResponse(t)(res)
			require.NoError(t, err)
			require.NotNil(t, doer.Req)
			require.Equal(t, http.MethodPost, doer.Req.Method)
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"), body)
			require.Equal(t, "http://localhost:9090/api/v1/series", doer.Req.URL.String())
		})

		t.Run("respects GET-only path for label values endpoint", func(t *testing.T) {
			doer := &MockDoer{}
			client := NewClient(doer, http.MethodPost, "http://localhost:9090", "60s")

			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "api/v1/label/label_key/values",
				Method:        http.MethodPost,
				URL:           "api/v1/label/label_key/values?match%5B%5D=ALERTS&start=1655272558&end=1655294158",
			}
			res, err := client.QueryResource(context.Background(), req)
			defer mustCloseResponse(t)(res)
			require.NoError(t, err)
			require.NotNil(t, doer.Req)

			// Verify GET is used instead of POST because endpoint is in endpointsSupportOnlyGet list
			require.Equal(t, http.MethodGet, doer.Req.Method)

			// Verify URL is preserved
			require.Equal(t, "http://localhost:9090/api/v1/label/label_key/values?match%5B%5D=ALERTS&start=1655272558&end=1655294158", doer.Req.URL.String())

			// Verify body is empty
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte{}, body)
		})

		t.Run("respects client configured with GET-only method", func(t *testing.T) {
			doer := &MockDoer{}
			// Client specifically configured to use GET
			client := NewClient(doer, http.MethodGet, "http://localhost:9090", "60s")

			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "api/v1/query",  // Not in endpointsSupportOnlyGet list
				Method:        http.MethodPost, // This would normally trigger a POST, but client is configured for GET
				URL:           "api/v1/query",
				Body:          []byte("query=up&time=1234"),
			}
			res, err := client.QueryResource(context.Background(), req)
			defer mustCloseResponse(t)(res)
			require.NoError(t, err)
			require.NotNil(t, doer.Req)

			// Verify GET is used because client is configured for GET
			require.Equal(t, http.MethodGet, doer.Req.Method)

			// Verify only one request was made (no POST attempt)
			require.Equal(t, 1, doer.RequestCount)

			// Verify body params were moved to URL
			require.Equal(t, "http://localhost:9090/api/v1/query?query=up&time=1234", doer.Req.URL.String())

			// Verify body is empty
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte{}, body)
		})

		t.Run("does not fall back to GET when using GET client and getting errors", func(t *testing.T) {
			doer := &MockDoer{
				ResponseStatus: http.StatusBadRequest,
				ResponseError:  fmt.Errorf("bad request error"),
			}
			// Client specifically configured to use GET
			client := NewClient(doer, http.MethodGet, "http://localhost:9090", "60s")

			req := &backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "api/v1/query",
				Method:        http.MethodGet,
				URL:           "api/v1/query",
				Body:          []byte("query=up&time=1234"),
			}
			res, err := client.QueryResource(context.Background(), req)
			defer mustCloseResponse(t)(res)

			// Error should be returned (no fallback attempted)
			require.Error(t, err)
			require.NotNil(t, res) // Ensure response is still returned

			// Verify only one request was made
			require.Equal(t, 1, doer.RequestCount)

			// Verify GET was used
			require.Equal(t, http.MethodGet, doer.Req.Method)
		})

		t.Run("no fallback when POST succeeds even with error status", func(t *testing.T) {
			doer := &MockDoer{
				ResponseStatus: http.StatusInternalServerError, // 500 error, not 400/405
				ResponseError:  nil,
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
			defer mustCloseResponse(t)(res)
			require.NoError(t, err) // No error in request, but status code is 500

			// Verify only one request was made (no fallback)
			require.Equal(t, 1, doer.RequestCount)

			// Verify POST was used
			require.Equal(t, http.MethodPost, doer.Req.Method)

			// Verify status code
			require.Equal(t, http.StatusInternalServerError, res.StatusCode)
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
			defer mustCloseResponse(t)(res)
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
			_, err := client.QueryResource(context.Background(), req)
			// defer mustCloseResponse(t)(res)
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
			defer mustCloseResponse(t)(res)
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
			defer mustCloseResponse(t)(res)
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
			defer mustCloseResponse(t)(res)
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
				Expr:       `rate(ALERTS{job="test"}[$__rate_interval])`,
				Start:      time.Unix(0, 0),
				End:        time.Unix(1234, 0),
				RangeQuery: true,
				Step:       1 * time.Second,
			}
			res, err := client.QueryRange(context.Background(), req)
			defer mustCloseResponse(t)(res)
			require.NoError(t, err)
			require.NotNil(t, doer.Req)
			require.Equal(t, http.MethodPost, doer.Req.Method)
			require.Equal(t, "application/x-www-form-urlencoded", doer.Req.Header.Get("Content-Type"))
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte("end=1234&query=rate%28ALERTS%7Bjob%3D%22test%22%7D%5B%24__rate_interval%5D%29&start=0&step=1&timeout=60s"), body)
			require.Equal(t, "http://localhost:9090/api/v1/query_range", doer.Req.URL.String())
		})

		t.Run("sends correct GET query", func(t *testing.T) {
			doer := &MockDoer{}
			client := NewClient(doer, http.MethodGet, "http://localhost:9090", "60s")
			req := &models.Query{
				Expr:       `rate(ALERTS{job="test"}[$__rate_interval])`,
				Start:      time.Unix(0, 0),
				End:        time.Unix(1234, 0),
				RangeQuery: true,
				Step:       1 * time.Second,
			}
			res, err := client.QueryRange(context.Background(), req)
			defer mustCloseResponse(t)(res)
			require.NoError(t, err)
			require.NotNil(t, doer.Req)
			require.Equal(t, http.MethodGet, doer.Req.Method)
			body, err := io.ReadAll(doer.Req.Body)
			require.NoError(t, err)
			require.Equal(t, []byte{}, body)
			require.Equal(t,
				`http://localhost:9090/api/v1/query_range?end=1234&query=rate(ALERTS{job="test"}[$__rate_interval])&start=0&step=1&timeout=60s`,
				urlMustUnescape(t, doer.Req.URL.String()),
			)
		})
	})

	t.Run("Helper Functions", func(t *testing.T) {
		t.Run("prepareResourceURL", func(t *testing.T) {
			client := NewClient(&MockDoer{}, http.MethodPost, "http://localhost:9090", "60s")

			t.Run("combines base URL with path and query params", func(t *testing.T) {
				u, err := client.prepareResourceURL(
					"api/v1/query?query=up&time=1234",
					"api/v1/query",
				)
				require.NoError(t, err)
				require.Equal(t, "http://localhost:9090/api/v1/query?query=up&time=1234", u.String())
			})

			t.Run("handles empty query params", func(t *testing.T) {
				u, err := client.prepareResourceURL(
					"api/v1/query",
					"api/v1/query",
				)
				require.NoError(t, err)
				require.Equal(t, "http://localhost:9090/api/v1/query", u.String())
			})

			t.Run("handles invalid URL", func(t *testing.T) {
				_, err := client.prepareResourceURL(
					"://invalid-url",
					"api/v1/query",
				)
				require.Error(t, err)
			})
		})

		t.Run("shouldUseGetMethod", func(t *testing.T) {
			t.Run("when client is configured for GET", func(t *testing.T) {
				client := NewClient(&MockDoer{}, http.MethodGet, "http://localhost:9090", "60s")
				require.True(t, client.shouldUseGetMethod("api/v1/query"))
				require.True(t, client.shouldUseGetMethod("api/v1/series"))
				require.True(t, client.shouldUseGetMethod("any/endpoint"))
			})

			t.Run("when client is configured for POST", func(t *testing.T) {
				client := NewClient(&MockDoer{}, http.MethodPost, "http://localhost:9090", "60s")

				require.True(t, client.shouldUseGetMethod("api/v1/label/job/values"))
				require.True(t, client.shouldUseGetMethod("api/v1/metadata"))
				require.True(t, client.shouldUseGetMethod("api/v1/targets"))

				require.False(t, client.shouldUseGetMethod("api/v1/query"))
				require.False(t, client.shouldUseGetMethod("api/v1/series"))
			})
		})

		t.Run("executeResourceQueryWithFallback", func(t *testing.T) {
			t.Run("uses GET with empty body when useGet is true", func(t *testing.T) {
				doer := &MockDoer{}
				client := NewClient(doer, http.MethodPost, "http://localhost:9090", "60s")

				u, _ := url.Parse("http://localhost:9090/api/v1/labels")
				body := []byte("match[]=resource_query_body")

				res, err := client.executeResourceQueryWithFallback(context.Background(), u, body, true)
				defer mustCloseResponse(t)(res)
				require.NoError(t, err)
				require.Equal(t, http.MethodGet, doer.Req.Method)
				require.Equal(t, "http://localhost:9090/api/v1/labels?match[]=resource_query_body",
					urlMustUnescape(t, doer.Req.URL.String()))

				reqBody, err := io.ReadAll(doer.Req.Body)
				require.NoError(t, err)
				require.Empty(t, reqBody)
			})

			t.Run("uses POST with body when useGet is false", func(t *testing.T) {
				doer := &MockDoer{}
				client := NewClient(doer, http.MethodPost, "http://localhost:9090", "60s")

				u, _ := url.Parse("http://localhost:9090/api/v1/labels")
				body := []byte("match[]=resource_query_body")

				res, err := client.executeResourceQueryWithFallback(context.Background(), u, body, false)
				defer mustCloseResponse(t)(res)
				require.NoError(t, err)
				require.Equal(t, http.MethodPost, doer.Req.Method)

				reqBody, err := io.ReadAll(doer.Req.Body)
				require.NoError(t, err)
				require.Equal(t, body, reqBody)
			})

			t.Run("falls back to GET when POST returns 405", func(t *testing.T) {
				doer := &MockDoer{
					ResponseStatus: http.StatusMethodNotAllowed,
					NextStatus:     http.StatusOK,
				}
				client := NewClient(doer, http.MethodPost, "http://localhost:9090", "60s")

				u, _ := url.Parse("http://localhost:9090/api/v1/labels")
				body := []byte("match[]=resource_query_body")

				res, err := client.executeResourceQueryWithFallback(context.Background(), u, body, false)
				defer mustCloseResponse(t)(res)
				require.NoError(t, err)
				require.Equal(t, 2, doer.RequestCount)
				require.Equal(t, http.MethodGet, doer.Req.Method)
				require.Equal(t, "http://localhost:9090/api/v1/labels?match[]=resource_query_body",
					urlMustUnescape(t, doer.Req.URL.String()))
			})

			t.Run("falls back to GET when POST returns 400", func(t *testing.T) {
				doer := &MockDoer{
					ResponseStatus: http.StatusBadRequest,
					NextStatus:     http.StatusOK,
				}
				client := NewClient(doer, http.MethodPost, "http://localhost:9090", "60s")

				u, _ := url.Parse("http://localhost:9090/api/v1/labels")
				body := []byte("match[]=resource_query_body")

				res, err := client.executeResourceQueryWithFallback(context.Background(), u, body, false)
				defer mustCloseResponse(t)(res)
				require.NoError(t, err)
				require.Equal(t, 2, doer.RequestCount)
				require.Equal(t, http.MethodGet, doer.Req.Method)
				require.Equal(t, "http://localhost:9090/api/v1/labels?match[]=resource_query_body",
					urlMustUnescape(t, doer.Req.URL.String()))
			})

			t.Run("returns error when both POST and GET fail", func(t *testing.T) {
				doer := &MockDoer{
					ResponseStatus: http.StatusBadRequest,
					NextStatus:     http.StatusInternalServerError,
				}
				client := NewClient(doer, http.MethodPost, "http://localhost:9090", "60s")

				u, _ := url.Parse("http://localhost:9090/api/v1/labels")
				body := []byte("match[]=resource_query_body")

				resp, err := client.executeResourceQueryWithFallback(context.Background(), u, body, false)
				defer mustCloseResponse(t)(resp)
				require.NoError(t, err)
				require.Equal(t, 2, doer.RequestCount)            // Should try both POST and GET
				require.Equal(t, http.MethodGet, doer.Req.Method) // Last request should be GET
				require.Equal(t, "http://localhost:9090/api/v1/labels?match[]=resource_query_body",
					urlMustUnescape(t, doer.Req.URL.String()))
				require.NotNil(t, resp)
				require.Equal(t, http.StatusInternalServerError, resp.StatusCode)
			})
		})
	})
}
