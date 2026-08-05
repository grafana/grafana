package fswebassets_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	fswebassets "github.com/grafana/grafana/pkg/services/frontend/webassets"
	"github.com/grafana/grafana/pkg/setting"
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

	t.Run("should cache manifest fetch errors between requests", func(t *testing.T) {
		fswebassets.ResetPreviewAssetsCache()
		var requests atomic.Int64
		server := newBucketServer(t, "pr_grafana_42", &requests)
		preview := fswebassets.PreviewAssetsConfig{Enabled: true, BaseURL: server.URL + "/"}

		for range 3 {
			_, err := fswebassets.GetPreviewWebAssets(context.Background(), preview, "pr_grafana_999")
			require.Error(t, err)
		}

		assert.Equal(t, int64(1), requests.Load(), "a failing manifest lookup should only hit the bucket once within the cache TTL")
	})

	t.Run("should coalesce concurrent fetches into one request", func(t *testing.T) {
		fswebassets.ResetPreviewAssetsCache()
		var requests atomic.Int64
		release := make(chan struct{})
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requests.Add(1)
			<-release
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(previewManifest))
		}))
		t.Cleanup(server.Close)
		preview := fswebassets.PreviewAssetsConfig{Enabled: true, BaseURL: server.URL + "/"}

		var wg sync.WaitGroup
		for range 5 {
			wg.Go(func() {
				_, err := fswebassets.GetPreviewWebAssets(context.Background(), preview, "pr_grafana_42")
				assert.NoError(t, err)
			})
		}
		close(release)
		wg.Wait()

		assert.Equal(t, int64(1), requests.Load(), "concurrent callers should share one fetch")
	})

	t.Run("should not fail other callers when one caller is cancelled", func(t *testing.T) {
		fswebassets.ResetPreviewAssetsCache()
		var requests atomic.Int64
		release := make(chan struct{})
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requests.Add(1)
			<-release
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(previewManifest))
		}))
		t.Cleanup(server.Close)
		preview := fswebassets.PreviewAssetsConfig{Enabled: true, BaseURL: server.URL + "/"}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		leaderErr := make(chan error, 1)
		go func() {
			_, err := fswebassets.GetPreviewWebAssets(ctx, preview, "pr_grafana_42")
			leaderErr <- err
		}()

		// Wait until the leader's fetch is in flight, then cancel the leader.
		require.Eventually(t, func() bool { return requests.Load() == 1 }, time.Second, 10*time.Millisecond)
		cancel()
		require.ErrorIs(t, <-leaderErr, context.Canceled)

		// The detached fetch must still complete and serve a later caller.
		close(release)
		_, err := fswebassets.GetPreviewWebAssets(context.Background(), preview, "pr_grafana_42")
		require.NoError(t, err)
		assert.Equal(t, int64(1), requests.Load(), "the cancelled caller's fetch should be reused, not retried")
	})
}

func TestNamespaceAllowed(t *testing.T) {
	cfg := fswebassets.PreviewAssetsConfig{
		Enabled:           true,
		BaseURL:           "https://storage.example.com/bucket/",
		AllowedNamespaces: []string{"stacks-123", "stacks-456"},
	}

	assert.True(t, cfg.NamespaceAllowed("stacks-123"))
	assert.True(t, cfg.NamespaceAllowed("stacks-456"))
	assert.False(t, cfg.NamespaceAllowed("stacks-789"))
	assert.False(t, cfg.NamespaceAllowed(""), "requests without a namespace must fail closed")

	empty := fswebassets.PreviewAssetsConfig{Enabled: true, BaseURL: "https://storage.example.com/"}
	assert.False(t, empty.NamespaceAllowed("stacks-123"), "an empty allowlist must not allow any namespace")
}

func TestReadPreviewAssetsConfig(t *testing.T) {
	raw := ini.Empty()
	sec := raw.Section("frontend_service")
	sec.Key("preview_assets_enabled").SetValue("true")
	sec.Key("preview_assets_base_url").SetValue("https://storage.example.com/bucket/")
	sec.Key("preview_assets_allowed_namespaces").SetValue("stacks-123, stacks-456")

	cfg := fswebassets.ReadPreviewAssetsConfig(&setting.Cfg{Raw: raw})
	assert.True(t, cfg.Enabled)
	assert.Equal(t, "https://storage.example.com/bucket/", cfg.BaseURL)
	assert.Equal(t, []string{"stacks-123", "stacks-456"}, cfg.AllowedNamespaces)
}
