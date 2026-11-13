package rendering

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDoRequestAndWriteToFile_PageLoadFailure(t *testing.T) {
	newService := func(t *testing.T, handler http.HandlerFunc) (*RenderingService, *url.URL) {
		t.Helper()
		server := httptest.NewServer(handler)
		t.Cleanup(server.Close)

		cfg := setting.NewCfg()
		cfg.ImagesDir = t.TempDir()
		cfg.CSVsDir = t.TempDir()
		rs := &RenderingService{Cfg: cfg, log: log.New("rendering-test"), netClient: server.Client()}

		u, err := url.Parse(server.URL + "/render?url=http://grafana/d/missing")
		require.NoError(t, err)
		return rs, u
	}
	opts := TimeoutOpts{Timeout: 5 * time.Second}

	t.Run("a 424 becomes a PageLoadError carrying the reason", func(t *testing.T) {
		rs, u := newService(t, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "Dashboard not found", http.StatusFailedDependency)
		})

		_, err := rs.doRequestAndWriteToFile(context.Background(), RenderPNG, u, opts, nil)

		var pageErr *PageLoadError
		require.ErrorAs(t, err, &pageErr)
		require.Equal(t, "Dashboard not found", pageErr.Reason)
	})

	t.Run("CSV rendering gets the same treatment", func(t *testing.T) {
		rs, u := newService(t, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "Access denied", http.StatusFailedDependency)
		})

		_, err := rs.doRequestAndWriteToFile(context.Background(), RenderCSV, u, opts, nil)

		var pageErr *PageLoadError
		require.ErrorAs(t, err, &pageErr)
		require.Equal(t, "Access denied", pageErr.Reason)
	})

	t.Run("the reason is capped and cleaned", func(t *testing.T) {
		rs, u := newService(t, func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusFailedDependency)
			_, _ = w.Write([]byte(strings.Repeat("a", 5000)))
		})

		_, err := rs.doRequestAndWriteToFile(context.Background(), RenderPNG, u, opts, nil)

		var pageErr *PageLoadError
		require.ErrorAs(t, err, &pageErr)
		require.Len(t, pageErr.Reason, maxPageLoadReasonBytes)
	})

	t.Run("an empty body still yields a PageLoadError", func(t *testing.T) {
		rs, u := newService(t, func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusFailedDependency)
		})

		_, err := rs.doRequestAndWriteToFile(context.Background(), RenderPNG, u, opts, nil)

		var pageErr *PageLoadError
		require.ErrorAs(t, err, &pageErr)
		require.Empty(t, pageErr.Reason)
		require.Equal(t, "the page could not be loaded", err.Error())
	})

	t.Run("other failures are not page load errors", func(t *testing.T) {
		rs, u := newService(t, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "Failed to render", http.StatusInternalServerError)
		})

		_, err := rs.doRequestAndWriteToFile(context.Background(), RenderPNG, u, opts, nil)

		require.Error(t, err)
		var pageErr *PageLoadError
		require.NotErrorAs(t, err, &pageErr)
		require.Contains(t, err.Error(), "status code: 500")
	})
}
