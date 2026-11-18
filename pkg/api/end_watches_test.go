package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/require"
)

func TestEndWatchesOnShutdown(t *testing.T) {
	// serve starts a request that runs until its context ends, and ended
	// reports whether the context ended. The request is released when the
	// test ends, so that none outlives it.
	serve := func(t *testing.T, stop context.Context, target string) (ended func() bool) {
		t.Helper()
		done := make(chan struct{})
		release := make(chan struct{})
		t.Cleanup(func() { close(release) })
		h := endWatchesOnShutdown(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			select {
			case <-r.Context().Done():
				close(done)
			case <-release:
			}
		}), stop)
		go h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, target, nil))
		return func() bool {
			select {
			case <-done:
				return true
			default:
				return false
			}
		}
	}

	t.Run("a watch ends at shutdown", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			stop, shutdown := context.WithCancel(context.Background())
			ended := serve(t, stop, "/apis/x.grafana.app/v1/namespaces/default/things?watch=true&resourceVersion=1")
			synctest.Wait()
			require.False(t, ended())
			shutdown()
			synctest.Wait()
			require.True(t, ended())
		})
	})

	t.Run("other requests are left to finish", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			stop, shutdown := context.WithCancel(context.Background())
			defer shutdown()
			var ended []func() bool
			targets := []string{"/api/things", "/apis/x.grafana.app/v1/things?watch=false", "/apis/x.grafana.app/v1/things?labelSelector=watch"}
			for _, target := range targets {
				ended = append(ended, serve(t, stop, target))
			}
			synctest.Wait()
			shutdown()
			synctest.Wait()
			for i, target := range targets {
				require.False(t, ended[i](), target)
			}
		})
	})
}
