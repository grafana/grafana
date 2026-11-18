package api

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestPatClientIP(t *testing.T) {
	newCtx := func(remote, xff string) *contextmodel.ReqContext {
		req := &http.Request{Header: http.Header{}, RemoteAddr: remote}
		if xff != "" {
			req.Header.Set("X-Forwarded-For", xff)
		}
		return &contextmodel.ReqContext{Context: &web.Context{Req: req}}
	}

	hs := &HTTPServer{Cfg: setting.NewCfg()}
	require.Equal(t, "10.0.0.5", hs.patClientIP(newCtx("10.0.0.5:4444", "1.2.3.4")), "forged header ignored by default, port stripped")

	hs.Cfg.PersonalAccessTokens.TrustedProxies = []string{"10.0.0.0/8"}
	hs.Cfg.PersonalAccessTokens.TrustedProxyHeader = "X-Forwarded-For"
	require.Equal(t, "1.2.3.4", hs.patClientIP(newCtx("10.0.0.5:4444", "1.2.3.4")))
	require.Equal(t, "8.8.8.8", hs.patClientIP(newCtx("8.8.8.8:1", "1.2.3.4")), "untrusted peer")
}
