package rendering

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGetUrl(t *testing.T) {
	path := "render/d-solo/test?orgId=1&panelId=5"
	for _, tc := range []struct{ name, callback, renderer, protocol, subpath, want string }{
		{"remote callback", "https://public-grafana.com", "http://renderer", "http", "", "https://public-grafana.com/"},
		{"HTTP", "", "", "http", "", "http://localhost:3000/"},
		{"HTTPS", "", "", "https", "", "https://localhost:3000/"},
		{"HTTP2", "", "", "h2", "", "https://localhost:3000/"},
		{"subpath", "", "", "http", "/grafana", "http://localhost:3000/grafana/"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.HTTPAddr = setting.DefaultHTTPAddr
			cfg.HTTPPort = "3000"
			cfg.RendererCallbackUrl, cfg.RendererServerUrl, cfg.Protocol = tc.callback, tc.renderer, setting.Scheme(tc.protocol)
			cfg.ServeFromSubPath, cfg.AppSubURL = tc.subpath != "", tc.subpath
			cfg.ImagesDir, cfg.CSVsDir, cfg.PDFsDir = t.TempDir(), t.TempDir(), t.TempDir()
			rs, err := ProvideService(cfg, featuremgmt.WithFeatures(), nil)
			require.NoError(t, err)
			settings, err := rs.settings(t.Context())
			require.NoError(t, err)
			require.Equal(t, tc.want+path+"&render=1", settings.callbackURL(path))
		})
	}
}

func TestRenderErrorImage(t *testing.T) {
	path, err := filepath.Abs("../../../")
	require.NoError(t, err)

	rs := RenderingService{
		store: FileStore{HomePath: path},
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
		settings: func(context.Context) (Settings, error) { return Settings{}, nil },
		log:      log.New("test"),
	}
	opts := Opts{ErrorOpts: ErrorOpts{ErrorRenderUnavailable: true}}
	result, err := rs.Render(context.Background(), RenderPNG, opts)
	assert.Equal(t, ErrRenderUnavailable, err)
	assert.Nil(t, result)
}

func TestRenderLimitImage(t *testing.T) {
	path, err := filepath.Abs("../../../")
	require.NoError(t, err)

	rs := RenderingService{
		store: FileStore{HomePath: path},
		settings: func(context.Context) (Settings, error) {
			return Settings{}, nil
		},
		log: log.New("test"),
		keys: &jwtRenderKeyProvider{
			authToken: []byte("test"),
			keyExpiry: time.Hour,
			log:       log.New("test"),
		},
	}
	rs.renderer = ImageRendererConfig{URL: "http://localhost:8081/render"}
	rs.availability = ConfiguredAvailability{}
	rs.limiter = NewLocalConcurrencyLimiter()
	first, err := rs.limiter.Acquire(t.Context(), Tenant{}, 0)
	require.NoError(t, err)
	defer first()
	second, err := rs.limiter.Acquire(t.Context(), Tenant{}, 0)
	require.NoError(t, err)
	defer second()

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
			result, err := rs.Render(t.Context(), RenderPNG, opts)
			require.NoError(t, err)
			assert.Equal(t, tc.expected, result.FilePath)
		})
	}
}

func TestRenderLimitImageError(t *testing.T) {
	rs := RenderingService{
		settings: func(context.Context) (Settings, error) {
			return Settings{}, nil
		},
		log: log.New("test"),
		keys: &jwtRenderKeyProvider{
			authToken: []byte("test"),
			keyExpiry: time.Hour,
			log:       log.New("test"),
		},
	}
	rs.renderer = ImageRendererConfig{URL: "http://localhost:8081/render"}
	rs.availability = ConfiguredAvailability{}
	rs.limiter = NewLocalConcurrencyLimiter()
	first, err := rs.limiter.Acquire(t.Context(), Tenant{}, 0)
	require.NoError(t, err)
	defer first()
	second, err := rs.limiter.Acquire(t.Context(), Tenant{}, 0)
	require.NoError(t, err)
	defer second()

	opts := Opts{
		CommonOpts: CommonOpts{ConcurrentLimit: 1},
		ErrorOpts:  ErrorOpts{ErrorConcurrentLimitReached: true},
		Theme:      models.ThemeDark,
	}
	result, err := rs.Render(t.Context(), RenderPNG, opts)
	assert.Equal(t, ErrConcurrentLimitReached, err)
	assert.Nil(t, result)
}

func TestProvideService(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.AppURL = "http://app-url"
	cfg.ImagesDir = filepath.Join(t.TempDir(), "images")
	cfg.CSVsDir = filepath.Join(t.TempDir(), "csvs")
	cfg.PDFsDir = filepath.Join(t.TempDir(), "pdfs")

	t.Run("Default configuration values", func(t *testing.T) {
		rs, err := ProvideService(cfg, featuremgmt.WithFeatures(), nil)
		require.NoError(t, err)

		require.Equal(t, "", rs.renderer.URL)
		require.False(t, rs.IsAvailable(t.Context()))
		require.Equal(t, "", mustSettings(t, rs).Domain)
	})

	t.Run("RendererURL is set but not RendererCallbackUrl", func(t *testing.T) {
		cfg.RendererServerUrl = "http://custom-renderer:8081"
		cfg.RendererCallbackUrl = ""

		rs, err := ProvideService(cfg, featuremgmt.WithFeatures(), nil)
		require.NoError(t, err)

		require.Equal(t, "http://custom-renderer:8081", rs.renderer.URL)
		require.Equal(t, "http://app-url/", mustSettings(t, rs).CallbackURL)
		require.Equal(t, "app-url", mustSettings(t, rs).Domain)
	})

	t.Run("RendererURL and RendererCallbackUrl are set", func(t *testing.T) {
		cfg.RendererServerUrl = "http://custom-renderer:8081"
		cfg.RendererCallbackUrl = "http://public-grafana.com/"

		rs, err := ProvideService(cfg, featuremgmt.WithFeatures(), nil)
		require.NoError(t, err)

		require.Equal(t, "http://custom-renderer:8081", rs.renderer.URL)
		require.Equal(t, "http://public-grafana.com/", mustSettings(t, rs).CallbackURL)
		require.Equal(t, "public-grafana.com", mustSettings(t, rs).Domain)
	})

	t.Run("RendererURL is not set but RendererCallbackUrl is set", func(t *testing.T) {
		cfg.RendererServerUrl = ""
		cfg.RendererCallbackUrl = "https://public-grafana.com/"

		rs, err := ProvideService(cfg, featuremgmt.WithFeatures(), nil)
		require.NoError(t, err)

		require.Equal(t, "", rs.renderer.URL)
		require.Equal(t, "https://public-grafana.com/", mustSettings(t, rs).CallbackURL)
		require.Equal(t, "public-grafana.com", mustSettings(t, rs).Domain)
	})

	t.Run("RendererCallbackURL is missing trailing slash", func(t *testing.T) {
		cfg.RendererServerUrl = ""
		cfg.RendererCallbackUrl = "https://public-grafana.com"

		rs, err := ProvideService(cfg, featuremgmt.WithFeatures(), nil)
		require.NoError(t, err)

		require.Equal(t, "", rs.renderer.URL)
		require.Equal(t, "https://public-grafana.com/", mustSettings(t, rs).CallbackURL)
		require.Equal(t, "public-grafana.com", mustSettings(t, rs).Domain)
	})

	t.Run("RendererCallbackURL is invalid", func(t *testing.T) {
		cfg.RendererServerUrl = ""
		cfg.RendererCallbackUrl = "http://public{grafana"

		_, err := ProvideService(cfg, featuremgmt.WithFeatures(), nil)
		require.Error(t, err)
	})

	t.Run("renderAuthJWT", func(t *testing.T) {
		t.Run("with an empty renderer auth token", func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.AppURL = "http://app-url"
			cfg.RendererServerUrl = "https://public-grafana.com/"
			cfg.ImagesDir = filepath.Join(t.TempDir(), "images")
			cfg.CSVsDir = filepath.Join(t.TempDir(), "csvs")
			cfg.PDFsDir = filepath.Join(t.TempDir(), "pdfs")
			cfg.RendererAuthToken = "   "

			t.Run("in dev mode returns an error", func(t *testing.T) {
				cfg.Env = setting.Dev
				_, err := ProvideService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagRenderAuthJWT), nil)
				require.Error(t, err)
			})

			t.Run("in prod mode returns an error", func(t *testing.T) {
				cfg.Env = setting.Prod
				_, err := ProvideService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagRenderAuthJWT), nil)
				require.Error(t, err)
			})
		})

		t.Run("with the default renderer auth token", func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.AppURL = "http://app-url"
			cfg.RendererServerUrl = "https://public-grafana.com/"
			cfg.ImagesDir = filepath.Join(t.TempDir(), "images")
			cfg.CSVsDir = filepath.Join(t.TempDir(), "csvs")
			cfg.PDFsDir = filepath.Join(t.TempDir(), "pdfs")
			cfg.RendererAuthToken = setting.DefaultRendererAuthToken

			t.Run("in dev mode does not return an error", func(t *testing.T) {
				cfg.Env = setting.Dev
				rs, err := ProvideService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagRenderAuthJWT), nil)
				require.NoError(t, err)
				require.NotNil(t, rs)
			})

			t.Run("in prod mode returns an error", func(t *testing.T) {
				cfg.Env = setting.Prod
				_, err := ProvideService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagRenderAuthJWT), nil)
				require.Error(t, err)
			})
		})

		t.Run("with non-default renderer auth token", func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.AppURL = "http://app-url"
			cfg.RendererServerUrl = "https://public-grafana.com/"
			cfg.ImagesDir = filepath.Join(t.TempDir(), "images")
			cfg.CSVsDir = filepath.Join(t.TempDir(), "csvs")
			cfg.PDFsDir = filepath.Join(t.TempDir(), "pdfs")
			cfg.RendererAuthToken = "some-value"

			t.Run("in dev mode does not return an error", func(t *testing.T) {
				cfg.Env = setting.Env
				rs, err := ProvideService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagRenderAuthJWT), nil)
				require.NoError(t, err)
				require.NotNil(t, rs)
			})

			t.Run("in prod mode does not return an error", func(t *testing.T) {
				cfg.Env = setting.Prod
				rs, err := ProvideService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagRenderAuthJWT), nil)
				require.NoError(t, err)
				require.NotNil(t, rs)
			})
		})
	})
}

func mustSettings(t *testing.T, rs *RenderingService) Settings {
	t.Helper()
	settings, err := rs.settings(t.Context())
	require.NoError(t, err)
	return settings
}
