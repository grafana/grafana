package proxyutil

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	responseHeaderTimeout = 1 * time.Second
)

func TestReverseProxy(t *testing.T) {
	t.Run("When proxying a request should enforce request and response constraints", func(t *testing.T) {
		var actualReq *http.Request
		upstream := newUpstreamServer(t, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			actualReq = req
			http.SetCookie(w, &http.Cookie{Name: "test"})
			w.Header().Set("Strict-Transport-Security", "max-age=31536000")
			w.Header().Set("X-Custom-Hdr", "Ok!")
			w.WriteHeader(http.StatusOK)
		}))
		t.Cleanup(upstream.Close)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, upstream.URL, nil)
		req.Header.Set("X-Forwarded-Host", "forwarded.host.com")
		req.Header.Set("X-Forwarded-Port", "8080")
		req.Header.Set("X-Forwarded-Proto", "https")
		req.Header.Set("Origin", "test.com")
		req.Header.Set("Referer", "https://test.com/api")
		req.RemoteAddr = "10.0.0.1"

		req = req.WithContext(contexthandler.WithAuthHTTPHeaders(req.Context(), setting.NewCfg()))
		req.Header.Set("Authorization", "val")

		rp := NewReverseProxy(log.New("test"),
			func(req *http.Request) {
				req.Header.Set("X-KEY", "value")
			},
			// Set response header timeout to avoid random `net/http: timeout awaiting response headers` errors in CI
			WithTransport(&http.Transport{
				ResponseHeaderTimeout: responseHeaderTimeout,
			}),
		)
		require.NotNil(t, rp)
		require.NotNil(t, rp.ModifyResponse)
		rp.ServeHTTP(rec, req)

		require.NotNil(t, actualReq)
		require.Empty(t, actualReq.Header.Get("X-Forwarded-Host"))
		require.Empty(t, actualReq.Header.Get("X-Forwarded-Port"))
		require.Empty(t, actualReq.Header.Get("X-Forwarded-Proto"))
		require.Equal(t, "10.0.0.1", actualReq.Header.Get("X-Forwarded-For"))
		require.Empty(t, actualReq.Header.Get("Origin"))
		require.Empty(t, actualReq.Header.Get("Referer"))
		require.Equal(t, "https://test.com/api", actualReq.Header.Get("X-Grafana-Referer"))
		require.Equal(t, "value", actualReq.Header.Get("X-KEY"))
		require.Empty(t, actualReq.Header.Get("Authorization"))
		resp := rec.Result()
		require.Empty(t, resp.Cookies())
		require.Equal(t, "sandbox", resp.Header.Get("Content-Security-Policy"))
		require.Contains(t, resp.Header, "X-Custom-Hdr")
		require.NotContains(t, resp.Header, "Strict-Transport-Security")
		require.Contains(t, resp.Header.Get("Via"), "grafana")
		require.NoError(t, resp.Body.Close())
	})

	t.Run("When proxying a request using WithModifyResponse should call it before default ModifyResponse func", func(t *testing.T) {
		var actualReq *http.Request
		upstream := newUpstreamServer(t, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			actualReq = req
			http.SetCookie(w, &http.Cookie{Name: "test"})
			w.WriteHeader(http.StatusOK)
		}))
		t.Cleanup(upstream.Close)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, upstream.URL, nil)
		rp := NewReverseProxy(
			log.New("test"),
			func(req *http.Request) {
				req.Header.Set("X-KEY", "value")
			},
			WithModifyResponse(func(r *http.Response) error {
				r.Header.Set("X-KEY2", "value2")
				return nil
			}),
			// Set response header timeout to avoid random `net/http: timeout awaiting response headers` errors in CI
			WithTransport(&http.Transport{
				ResponseHeaderTimeout: responseHeaderTimeout,
			}),
		)
		require.NotNil(t, rp)
		require.NotNil(t, rp.ModifyResponse)
		rp.ServeHTTP(rec, req)

		require.NotNil(t, actualReq)
		require.Equal(t, "value", actualReq.Header.Get("X-KEY"))
		resp := rec.Result()
		require.Empty(t, resp.Cookies())
		require.Equal(t, "sandbox", resp.Header.Get("Content-Security-Policy"))
		require.Equal(t, "value2", resp.Header.Get("X-KEY2"))
		require.NoError(t, resp.Body.Close())
	})

	t.Run("Error handling should convert status codes depending on what kind of error it is and set downstream status source", func(t *testing.T) {
		timedOutTransport := http.DefaultTransport.(*http.Transport)
		timedOutTransport.ResponseHeaderTimeout = time.Millisecond

		testCases := []struct {
			desc               string
			transport          http.RoundTripper
			responseWaitTime   time.Duration
			expectedStatusCode int
		}{
			{
				desc:               "Cancelled request should return 499 Client closed request",
				transport:          &cancelledRoundTripper{},
				expectedStatusCode: StatusClientClosedRequest,
			},
			{
				desc:               "Timed out request should return 504 Gateway timeout",
				transport:          timedOutTransport,
				responseWaitTime:   100 * time.Millisecond,
				expectedStatusCode: http.StatusGatewayTimeout,
			},
			{
				desc:               "Failed request should return 502 Bad gateway",
				transport:          &failingRoundTripper{},
				expectedStatusCode: http.StatusBadGateway,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				upstream := newUpstreamServer(t, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
					if tc.responseWaitTime > 0 {
						time.Sleep(tc.responseWaitTime)
					}

					w.WriteHeader(http.StatusOK)
				}))
				t.Cleanup(upstream.Close)
				rec := httptest.NewRecorder()

				ctx := requestmeta.SetRequestMetaData(context.Background(), requestmeta.RequestMetaData{
					StatusSource: requestmeta.StatusSourceServer,
				})
				req := httptest.NewRequest(http.MethodGet, upstream.URL, nil)
				req = req.WithContext(ctx)

				rp := NewReverseProxy(
					log.New("test"),
					func(req *http.Request) {},
					WithTransport(tc.transport),
				)
				require.NotNil(t, rp)
				require.NotNil(t, rp.Transport)
				require.Same(t, tc.transport, rp.Transport)
				rp.ServeHTTP(rec, req)

				resp := rec.Result()
				require.Equal(t, tc.expectedStatusCode, resp.StatusCode)
				require.NoError(t, resp.Body.Close())

				rmd := requestmeta.GetRequestMetaData(ctx)
				require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
			})
		}
	})

	t.Run("5xx response status codes should set downstream status source", func(t *testing.T) {
		testCases := []struct {
			status         int
			expectedSource requestmeta.StatusSource
		}{
			{status: http.StatusOK, expectedSource: requestmeta.StatusSourceServer},
			{status: http.StatusBadRequest, expectedSource: requestmeta.StatusSourceServer},
			{status: http.StatusForbidden, expectedSource: requestmeta.StatusSourceServer},
			{status: http.StatusUnauthorized, expectedSource: requestmeta.StatusSourceServer},
			{status: http.StatusInternalServerError, expectedSource: requestmeta.StatusSourceDownstream},
			{status: http.StatusBadGateway, expectedSource: requestmeta.StatusSourceDownstream},
			{status: http.StatusGatewayTimeout, expectedSource: requestmeta.StatusSourceDownstream},
			{status: 599, expectedSource: requestmeta.StatusSourceDownstream},
		}

		for _, testCase := range testCases {
			tc := testCase
			t.Run(fmt.Sprintf("status %d => source %s ", tc.status, tc.expectedSource), func(t *testing.T) {
				upstream := newUpstreamServer(t, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
					w.WriteHeader(tc.status)
				}))
				t.Cleanup(upstream.Close)
				rec := httptest.NewRecorder()

				ctx := requestmeta.SetRequestMetaData(context.Background(), requestmeta.RequestMetaData{
					StatusSource: requestmeta.StatusSourceServer,
				})
				req := httptest.NewRequest(http.MethodGet, upstream.URL, nil)
				req = req.WithContext(ctx)

				rp := NewReverseProxy(
					log.New("test"),
					func(req *http.Request) {},
					// Set response header timeout to avoid random `net/http: timeout awaiting response headers errors in CI
					WithTransport(&http.Transport{
						ResponseHeaderTimeout: responseHeaderTimeout,
					}),
				)
				require.NotNil(t, rp)
				rp.ServeHTTP(rec, req)

				resp := rec.Result()
				require.Equal(t, tc.status, resp.StatusCode)
				require.NoError(t, resp.Body.Close())

				rmd := requestmeta.GetRequestMetaData(ctx)
				require.Equal(t, tc.expectedSource, rmd.StatusSource)
			})
		}
	})
}

func newUpstreamServer(t *testing.T, handler http.Handler) *httptest.Server {
	t.Helper()

	upstream := httptest.NewServer(handler)
	return upstream
}

type cancelledRoundTripper struct{}

func (cancelledRoundTripper) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, context.Canceled
}

type failingRoundTripper struct{}

func (failingRoundTripper) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, errors.New("some error")
}
