package rendering

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestGetUrl(t *testing.T) {
	path := "render/d-solo/5SdHCadmz/panel-tests-graph?orgId=1&from=1587390211965&to=1587393811965&panelId=5&width=1000&height=500&tz=Europe%2FStockholm"
	rs := &RenderingService{
		Cfg: setting.NewCfg(),
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
		setting.HttpPort = "3000"

		t.Run("And protocol HTTP configured should return expected path", func(t *testing.T) {
			rs.Cfg.ServeFromSubPath = false
			rs.Cfg.AppSubUrl = ""
			setting.Protocol = setting.HTTPScheme
			url := rs.getURL(path)
			require.Equal(t, "http://localhost:3000/"+path+"&render=1", url)

			t.Run("And serve from sub path should return expected path", func(t *testing.T) {
				rs.Cfg.ServeFromSubPath = true
				rs.Cfg.AppSubUrl = "/grafana"
				url := rs.getURL(path)
				require.Equal(t, "http://localhost:3000/grafana/"+path+"&render=1", url)
			})
		})

		t.Run("And protocol HTTPS configured should return expected path", func(t *testing.T) {
			rs.Cfg.ServeFromSubPath = false
			rs.Cfg.AppSubUrl = ""
			setting.Protocol = setting.HTTPSScheme
			url := rs.getURL(path)
			require.Equal(t, "https://localhost:3000/"+path+"&render=1", url)
		})

		t.Run("And protocol HTTP2 configured should return expected path", func(t *testing.T) {
			rs.Cfg.ServeFromSubPath = false
			rs.Cfg.AppSubUrl = ""
			setting.Protocol = setting.HTTP2Scheme
			url := rs.getURL(path)
			require.Equal(t, "https://localhost:3000/"+path+"&render=1", url)
		})
	})
}
