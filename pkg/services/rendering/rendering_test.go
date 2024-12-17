package rendering

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGetUrl(t *testing.T) {
	path := "render/d-solo/5SdHCadmz/panel-tests-graph?orgId=1&from=1587390211965&to=1587393811965&panelId=5&width=1000&height=500&tz=Europe%2FStockholm"
	cfg := setting.NewCfg()
	rs := &RenderingService{
		Cfg: cfg,
	}

	t.Run("When renderer and callback url configured should return callback url plus path", func(t *testing.T) {
		rs.Cfg.RendererUrl = "http://localhost:8081/render"
		rs.Cfg.RendererCallbackUrl = "http://public-grafana.com/"
		url := rs.getGrafanaCallbackURL(path)
		require.Equal(t, rs.Cfg.RendererCallbackUrl+path+"&render=1", url)
	})

	t.Run("When renderer url not configured", func(t *testing.T) {
		rs.Cfg.RendererUrl = ""
		rs.domain = "localhost"
		rs.Cfg.HTTPPort = "3000"

		t.Run("And protocol HTTP configured should return expected path", func(t *testing.T) {
			rs.Cfg.ServeFromSubPath = false
			rs.Cfg.AppSubURL = ""
			rs.Cfg.Protocol = setting.HTTPScheme
			url := rs.getGrafanaCallbackURL(path)
			require.Equal(t, "http://localhost:3000/"+path+"&render=1", url)

			t.Run("And serve from sub path should return expected path", func(t *testing.T) {
				rs.Cfg.ServeFromSubPath = true
				rs.Cfg.AppSubURL = "/grafana"
				url := rs.getGrafanaCallbackURL(path)
				require.Equal(t, "http://localhost:3000/grafana/"+path+"&render=1", url)
			})
		})

		t.Run("And protocol HTTPS configured should return expected path", func(t *testing.T) {
			rs.Cfg.ServeFromSubPath = false
			rs.Cfg.AppSubURL = ""
			rs.Cfg.Protocol = setting.HTTPSScheme
			url := rs.getGrafanaCallbackURL(path)
			require.Equal(t, "https://localhost:3000/"+path+"&render=1", url)
		})

		t.Run("And protocol HTTP2 configured should return expected path", func(t *testing.T) {
			rs.Cfg.ServeFromSubPath = false
			rs.Cfg.AppSubURL = ""
			rs.Cfg.Protocol = setting.HTTP2Scheme
			url := rs.getGrafanaCallbackURL(path)
			require.Equal(t, "https://localhost:3000/"+path+"&render=1", url)
		})
	})
}

func TestRenderErrorImage(t *testing.T) {
	path, err := filepath.Abs("../../../")
	require.NoError(t, err)

	rs := RenderingService{
		Cfg: &setting.Cfg{
			HomePath: path,
		},
	}
	t.Run("No theme set returns error image with dark theme", func(t *testing.T) {
		result, err := rs.RenderErrorImage("", nil)
		require.NoError(t, err)
		assert.Equal(t, result.FilePath, path+"/public/img/rendering_error_dark.png")
	})

	t.Run("Timeout error returns timeout error image", func(t *testing.T) {
		result, err := rs.RenderErrorImage(models.ThemeLight, ErrTimeout)
		require.NoError(t, err)
		assert.Equal(t, result.FilePath, path+"/public/img/rendering_timeout_light.png")
	})

	t.Run("Generic error returns error image", func(t *testing.T) {
		result, err := rs.RenderErrorImage(models.ThemeLight, errors.New("an error"))
		require.NoError(t, err)
		assert.Equal(t, result.FilePath, path+"/public/img/rendering_error_light.png")
	})

	t.Run("Unknown image path returns error", func(t *testing.T) {
		result, err := rs.RenderErrorImage("abc", errors.New("random error"))
		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

func TestRenderUnavailableError(t *testing.T) {
	rs := RenderingService{
		Cfg:                   &setting.Cfg{},
		log:                   log.New("test"),
		RendererPluginManager: &dummyPluginManager{},
	}
	opts := Opts{ErrorOpts: ErrorOpts{ErrorRenderUnavailable: true}}
	result, err := rs.Render(context.Background(), RenderPNG, opts, nil)
	assert.Equal(t, ErrRenderUnavailable, err)
	assert.Nil(t, result)
}

func TestRenderLimitImage(t *testing.T) {
	path, err := filepath.Abs("../../../")
	require.NoError(t, err)

	rs := RenderingService{
		Cfg: &setting.Cfg{
			HomePath:    path,
			RendererUrl: "http://localhost:8081/render",
		},
		inProgressCount: 2,
		log:             log.New("test"),
	}

	tests := []struct {
		name     string
		theme    models.Theme
		expected string
	}{
		{
			name:     "Light theme returns light image",
			theme:    models.ThemeLight,
			expected: path + "/public/img/rendering_limit_light.png",
		},
		{
			name:     "Dark theme returns dark image",
			theme:    models.ThemeDark,
			expected: path + "/public/img/rendering_limit_dark.png",
		},
		{
			name:     "No theme returns dark image",
			theme:    "",
			expected: path + "/public/img/rendering_limit_dark.png",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			opts := Opts{Theme: tc.theme, CommonOpts: CommonOpts{ConcurrentLimit: 1}}
			result, err := rs.Render(context.Background(), RenderPNG, opts, nil)
			assert.NoError(t, err)
			assert.Equal(t, tc.expected, result.FilePath)
		})
	}
}

func TestRenderLimitImageError(t *testing.T) {
	rs := RenderingService{
		Cfg: &setting.Cfg{
			RendererUrl: "http://localhost:8081/render",
		},
		inProgressCount: 2,
		log:             log.New("test"),
	}
	opts := Opts{
		CommonOpts: CommonOpts{ConcurrentLimit: 1},
		ErrorOpts:  ErrorOpts{ErrorConcurrentLimitReached: true},
		Theme:      models.ThemeDark,
	}
	result, err := rs.Render(context.Background(), RenderPNG, opts, nil)
	assert.Equal(t, ErrConcurrentLimitReached, err)
	assert.Nil(t, result)
}

func TestRenderingServiceGetRemotePluginVersion(t *testing.T) {
	cfg := setting.NewCfg()
	rs := &RenderingService{
		Cfg: cfg,
		log: log.New("rendering-test"),
	}

	t.Run("When renderer responds with correct version should return that version", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, err := w.Write([]byte("{\"version\":\"2.7.1828\"}"))
			require.NoError(t, err)
		}))
		defer server.Close()

		rs.Cfg.RendererUrl = server.URL + "/render"
		version, err := rs.getRemotePluginVersion()

		require.NoError(t, err)
		require.Equal(t, "2.7.1828", version)
	})

	t.Run("When renderer responds with 404 should assume a valid but old version", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}))
		defer server.Close()

		rs.Cfg.RendererUrl = server.URL + "/render"
		version, err := rs.getRemotePluginVersion()

		require.NoError(t, err)
		require.Equal(t, version, "1.0.0")
	})

	t.Run("When renderer responds with 500 should retry until success", func(t *testing.T) {
		tries := uint(0)
		ctx, cancel := context.WithCancel(context.Background())
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			tries++

			if tries < remoteVersionFetchRetries {
				w.WriteHeader(http.StatusInternalServerError)
			} else {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_, err := w.Write([]byte("{\"version\":\"3.1.4159\"}"))
				require.NoError(t, err)
				cancel()
			}
		}))
		defer server.Close()

		rs.Cfg.RendererUrl = server.URL + "/render"
		remoteVersionFetchInterval = time.Millisecond
		remoteVersionFetchRetries = 5
		go func() {
			require.NoError(t, rs.Run(ctx))
		}()

		require.Eventually(t, func() bool { return rs.Version() == "3.1.4159" }, time.Second, time.Millisecond)
	})
}
