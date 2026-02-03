package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestAltSvcHeader(t *testing.T) {
	t.Run("should not set Alt-Svc header when HTTP/3 is disabled via config", func(t *testing.T) {
		cfg := &setting.Cfg{
			HTTP3Enabled: false,
			HTTP3Port:    "3000",
		}
		features := featuremgmt.WithFeatures(featuremgmt.FlagHttp3Server)

		handler := AltSvcHeader(cfg, features).(func(*web.Context))

		recorder := httptest.NewRecorder()
		ctx := &web.Context{
			Resp: web.NewResponseWriter(http.MethodGet, recorder),
			Req:  httptest.NewRequest(http.MethodGet, "/", nil),
		}

		handler(ctx)
		// Trigger the Before callback by writing something
		ctx.Resp.WriteHeader(http.StatusOK)

		assert.Empty(t, recorder.Header().Get("Alt-Svc"))
	})

	t.Run("should not set Alt-Svc header when feature flag is disabled", func(t *testing.T) {
		cfg := &setting.Cfg{
			HTTP3Enabled: true,
			HTTP3Port:    "3000",
		}
		features := featuremgmt.WithFeatures() // No features enabled

		handler := AltSvcHeader(cfg, features).(func(*web.Context))

		recorder := httptest.NewRecorder()
		ctx := &web.Context{
			Resp: web.NewResponseWriter(http.MethodGet, recorder),
			Req:  httptest.NewRequest(http.MethodGet, "/", nil),
		}

		handler(ctx)
		ctx.Resp.WriteHeader(http.StatusOK)

		assert.Empty(t, recorder.Header().Get("Alt-Svc"))
	})

	t.Run("should set Alt-Svc header when HTTP/3 is enabled", func(t *testing.T) {
		cfg := &setting.Cfg{
			HTTP3Enabled: true,
			HTTP3Port:    "3000",
		}
		features := featuremgmt.WithFeatures(featuremgmt.FlagHttp3Server)

		handler := AltSvcHeader(cfg, features).(func(*web.Context))

		recorder := httptest.NewRecorder()
		ctx := &web.Context{
			Resp: web.NewResponseWriter(http.MethodGet, recorder),
			Req:  httptest.NewRequest(http.MethodGet, "/", nil),
		}

		handler(ctx)
		ctx.Resp.WriteHeader(http.StatusOK)

		assert.Equal(t, `h3=":3000"; ma=86400`, recorder.Header().Get("Alt-Svc"))
	})

	t.Run("should use configured HTTP3 port in Alt-Svc header", func(t *testing.T) {
		cfg := &setting.Cfg{
			HTTP3Enabled: true,
			HTTP3Port:    "8443",
		}
		features := featuremgmt.WithFeatures(featuremgmt.FlagHttp3Server)

		handler := AltSvcHeader(cfg, features).(func(*web.Context))

		recorder := httptest.NewRecorder()
		ctx := &web.Context{
			Resp: web.NewResponseWriter(http.MethodGet, recorder),
			Req:  httptest.NewRequest(http.MethodGet, "/", nil),
		}

		handler(ctx)
		ctx.Resp.WriteHeader(http.StatusOK)

		assert.Equal(t, `h3=":8443"; ma=86400`, recorder.Header().Get("Alt-Svc"))
	})
}
