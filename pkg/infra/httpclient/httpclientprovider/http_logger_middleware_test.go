package httpclientprovider

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/storage"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestHTTPLoggerMiddleware(t *testing.T) {
	t.Run("Should return middleware name", func(t *testing.T) {
		mw := HTTPLoggerMiddleware(setting.PluginSettings{})
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, HTTPLoggerMiddlewareName, middlewareName.MiddlewareName())
	})

	t.Run("Should return next http.RoundTripper if not enabled", func(t *testing.T) {
		tempPath := path.Join(os.TempDir(), fmt.Sprintf("http_logger_test_%d.har", time.Now().UnixMilli()))
		ctx := &testContext{}
		finalRoundTripper := ctx.createRoundTripper("finalrt")
		mw := HTTPLoggerMiddleware(setting.PluginSettings{"example-datasource": {"har_log_enabled": "false", "har_log_path": tempPath}})
		rt := mw.CreateMiddleware(httpclient.Options{Labels: map[string]string{"datasource_type": "example-datasource"}}, finalRoundTripper)
		require.NotNil(t, rt)

		req, err := http.NewRequest(http.MethodGet, "http://", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}
		_, err = os.Stat(tempPath)
		require.Equal(t, true, errors.Is(err, os.ErrNotExist))
	})

	t.Run("Should add HTTP logger if enabled", func(t *testing.T) {
		f, err := os.CreateTemp("", "example_*.har")
		require.NoError(t, err)
		defer func() {
			err := os.Remove(f.Name())
			require.NoError(t, err)
		}()
		ctx := &testContext{}
		finalRoundTripper := ctx.createRoundTripper("finalrt")
		mw := HTTPLoggerMiddleware(setting.PluginSettings{"example-datasource": {"har_log_enabled": "true", "har_log_path": f.Name()}})
		rt := mw.CreateMiddleware(httpclient.Options{Labels: map[string]string{"datasource_type": "example-datasource"}}, finalRoundTripper)
		require.NotNil(t, rt)

		req, err := http.NewRequest(http.MethodGet, "http://", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}
		har := storage.NewHARStorage(f.Name())
		require.Equal(t, 1, len(har.Entries()))
		require.Equal(t, "http:", har.Entries()[0].Request.URL.String())
	})
}
