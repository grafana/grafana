package proxyutil

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

func TestReverseProxy(t *testing.T) {
	t.Run("When proxying a request should enforce request and response constraints", func(t *testing.T) {
		var actualReq *http.Request
		upstream := newUpstreamServer(t, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			actualReq = req
			http.SetCookie(w, &http.Cookie{Name: "test"})
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

		rp := NewReverseProxy(log.New("test"), func(req *http.Request) {
			fmt.Println(req.Header.Get("X-Forwarded-For"))
			req.Header.Set("X-KEY", "value")
		})
		rp.ServeHTTP(rec, req)

		require.NotNil(t, actualReq)
		require.Empty(t, actualReq.Header.Get("X-Forwarded-Host"))
		require.Empty(t, actualReq.Header.Get("X-Forwarded-Port"))
		require.Empty(t, actualReq.Header.Get("X-Forwarded-Proto"))
		require.Equal(t, "10.0.0.1", actualReq.Header.Get("X-Forwarded-For"))
		require.Empty(t, actualReq.Header.Get("Origin"))
		require.Empty(t, actualReq.Header.Get("Referer"))
		require.Equal(t, "value", actualReq.Header.Get("X-KEY"))
		resp := rec.Result()
		require.Empty(t, resp.Cookies())
		require.Equal(t, "sandbox", resp.Header.Get("Content-Security-Policy"))
		require.NoError(t, resp.Body.Close())
	})

	t.Run("When proxying a request that's being cancelled should return 400 bad request", func(t *testing.T) {
		upstream := newUpstreamServer(t, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		t.Cleanup(upstream.Close)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, upstream.URL, nil)

		rp := NewReverseProxy(
			log.New("test"),
			func(req *http.Request) {},
			WithTransport(cancelledRoundTripper{}),
		)
		rp.ServeHTTP(rec, req)

		resp := rec.Result()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})

	t.Run("When proxying a request that's being timed out should return 504 gateway timeout", func(t *testing.T) {
		upstream := newUpstreamServer(t, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			time.Sleep(10 * time.Millisecond)
			w.WriteHeader(http.StatusOK)
		}))
		t.Cleanup(upstream.Close)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, upstream.URL, nil)

		timedOutTransport := http.DefaultTransport.(*http.Transport)
		timedOutTransport.ResponseHeaderTimeout = time.Nanosecond

		rp := NewReverseProxy(
			log.New("test"),
			func(req *http.Request) {},
			WithTransport(timedOutTransport),
		)
		rp.ServeHTTP(rec, req)

		resp := rec.Result()
		require.Equal(t, http.StatusGatewayTimeout, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})

	t.Run("When proxying a request that fails should return 502 bad gateway", func(t *testing.T) {
		upstream := newUpstreamServer(t, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		t.Cleanup(upstream.Close)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, upstream.URL, nil)

		rp := NewReverseProxy(
			log.New("test"),
			func(req *http.Request) {},
			WithTransport(failingRoundTripper{}),
		)
		rp.ServeHTTP(rec, req)

		resp := rec.Result()
		require.Equal(t, http.StatusBadGateway, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
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
