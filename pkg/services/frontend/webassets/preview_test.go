package fswebassets_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	fswebassets "github.com/grafana/grafana/pkg/services/frontend/webassets"
)

func TestResolvePreviewAssetsURL(t *testing.T) {
	t.Run("should build the URL from the base URL and folder", func(t *testing.T) {
		url, err := fswebassets.ResolvePreviewAssetsURL("https://storage.example.com/bucket/", "pr_grafana_123456")
		require.NoError(t, err)
		assert.Equal(t, "https://storage.example.com/bucket/pr_grafana_123456/", url)
	})

	t.Run("should add a trailing slash to the base URL when missing", func(t *testing.T) {
		url, err := fswebassets.ResolvePreviewAssetsURL("https://storage.example.com/bucket", "pr_grafana_123456")
		require.NoError(t, err)
		assert.Equal(t, "https://storage.example.com/bucket/pr_grafana_123456/", url)
	})

	t.Run("should reject invalid folders", func(t *testing.T) {
		invalid := []string{
			"",
			"../otherfolder",
			"foo/bar",
			"foo bar",
			"foo.bar",
			"https://evil.example.com",
			"foo?bar=baz",
			"foo#bar",
			strings.Repeat("a", 129),
		}
		for _, folder := range invalid {
			_, err := fswebassets.ResolvePreviewAssetsURL("https://storage.example.com/bucket/", folder)
			assert.Error(t, err, "should reject folder: %q", folder)
		}
	})

	t.Run("should reject an empty base URL", func(t *testing.T) {
		_, err := fswebassets.ResolvePreviewAssetsURL("", "pr_grafana_123456")
		assert.Error(t, err)
	})
}

const previewManifest = `{
	"entrypoints": {
		"app": {
			"assets": {
				"js": ["public/build/runtime.preview.js", "public/build/app.preview.js"],
				"css": ["public/build/grafana.app.preview.css"]
			}
		},
		"dark": { "assets": { "css": ["public/build/grafana.dark.preview.css"] } },
		"light": { "assets": { "css": ["public/build/grafana.light.preview.css"] } }
	}
}`

func TestGetPreviewWebAssets(t *testing.T) {
	newBucketServer := func(t *testing.T, folder string, requests *atomic.Int64) *httptest.Server {
		t.Helper()
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if requests != nil {
				requests.Add(1)
			}
			if r.URL.Path == "/"+folder+"/public/build/assets-manifest.json" {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(previewManifest))
				return
			}
			http.NotFound(w, r)
		}))
		t.Cleanup(server.Close)
		return server
	}

	t.Run("should fetch the manifest and prefix all asset URLs", func(t *testing.T) {
		fswebassets.ResetPreviewAssetsCache()
		server := newBucketServer(t, "pr_grafana_42", nil)
		preview := fswebassets.PreviewAssetsConfig{Enabled: true, BaseURL: server.URL + "/"}

		assets, err := fswebassets.GetPreviewWebAssets(context.Background(), preview, "pr_grafana_42")
		require.NoError(t, err)

		previewURL := server.URL + "/pr_grafana_42/"
		assert.Equal(t, previewURL, assets.ContentDeliveryURL)
		assert.Equal(t, previewURL+"public/build/runtime.preview.js", assets.JSFiles[0].FilePath)
		assert.Equal(t, previewURL+"public/build/app.preview.js", assets.JSFiles[1].FilePath)
		assert.Equal(t, previewURL+"public/build/grafana.dark.preview.css", assets.Dark)
		assert.Equal(t, previewURL+"public/build/grafana.light.preview.css", assets.Light)
	})

	t.Run("should cache the manifest between requests", func(t *testing.T) {
		fswebassets.ResetPreviewAssetsCache()
		var requests atomic.Int64
		server := newBucketServer(t, "pr_grafana_42", &requests)
		preview := fswebassets.PreviewAssetsConfig{Enabled: true, BaseURL: server.URL + "/"}

		for range 3 {
			_, err := fswebassets.GetPreviewWebAssets(context.Background(), preview, "pr_grafana_42")
			require.NoError(t, err)
		}

		assert.Equal(t, int64(1), requests.Load(), "manifest should only be fetched once within the cache TTL")
	})

	t.Run("should error when the feature is not enabled", func(t *testing.T) {
		fswebassets.ResetPreviewAssetsCache()
		_, err := fswebassets.GetPreviewWebAssets(context.Background(), fswebassets.PreviewAssetsConfig{}, "pr_grafana_42")
		assert.Error(t, err)
	})

	t.Run("should error when the manifest does not exist", func(t *testing.T) {
		fswebassets.ResetPreviewAssetsCache()
		server := newBucketServer(t, "pr_grafana_42", nil)
		preview := fswebassets.PreviewAssetsConfig{Enabled: true, BaseURL: server.URL + "/"}

		_, err := fswebassets.GetPreviewWebAssets(context.Background(), preview, "pr_grafana_999")
		assert.Error(t, err)
	})
}
