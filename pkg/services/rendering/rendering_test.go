package rendering

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
		url := rs.getURL(path)
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
			url := rs.getURL(path)
			require.Equal(t, "http://localhost:3000/"+path+"&render=1", url)

			t.Run("And serve from sub path should return expected path", func(t *testing.T) {
				rs.Cfg.ServeFromSubPath = true
				rs.Cfg.AppSubURL = "/grafana"
				url := rs.getURL(path)
				require.Equal(t, "http://localhost:3000/grafana/"+path+"&render=1", url)
			})
		})

		t.Run("And protocol HTTPS configured should return expected path", func(t *testing.T) {
			rs.Cfg.ServeFromSubPath = false
			rs.Cfg.AppSubURL = ""
			rs.Cfg.Protocol = setting.HTTPSScheme
			url := rs.getURL(path)
			require.Equal(t, "https://localhost:3000/"+path+"&render=1", url)
		})

		t.Run("And protocol HTTP2 configured should return expected path", func(t *testing.T) {
			rs.Cfg.ServeFromSubPath = false
			rs.Cfg.AppSubURL = ""
			rs.Cfg.Protocol = setting.HTTP2Scheme
			url := rs.getURL(path)
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
		result, err := rs.RenderErrorImage(ThemeLight, ErrTimeout)
		require.NoError(t, err)
		assert.Equal(t, result.FilePath, path+"/public/img/rendering_timeout_light.png")
	})

	t.Run("Generic error returns error image", func(t *testing.T) {
		result, err := rs.RenderErrorImage(ThemeLight, errors.New("an error"))
		require.NoError(t, err)
		assert.Equal(t, result.FilePath, path+"/public/img/rendering_error_light.png")
	})

	t.Run("Unknown image path returns error", func(t *testing.T) {
		result, err := rs.RenderErrorImage("abc", errors.New("random error"))
		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

func TestRenderLimitImage(t *testing.T) {
	path, err := filepath.Abs("../../../")
	require.NoError(t, err)

	rs := RenderingService{
		Cfg: &setting.Cfg{
			HomePath: path,
		},
		inProgressCount: 2,
	}

	tests := []struct {
		name     string
		theme    Theme
		expected string
	}{
		{
			name:     "Light theme returns light image",
			theme:    ThemeLight,
			expected: path + "/public/img/rendering_limit_light.png",
		},
		{
			name:     "Dark theme returns dark image",
			theme:    ThemeDark,
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
			opts := Opts{Theme: tc.theme, ConcurrentLimit: 1}
			result, err := rs.Render(context.Background(), opts)
			assert.NoError(t, err)
			assert.Equal(t, tc.expected, result.FilePath)
		})
	}
}
