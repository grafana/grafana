package contexthandler

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func TestDontRotateTokensOnCancelledRequests(t *testing.T) {
	ctxHdlr := getContextHandler(t)
	tryRotateCallCount := 0
	ctxHdlr.AuthTokenService = &authtest.FakeUserAuthTokenService{
		TryRotateTokenProvider: func(ctx context.Context, token *auth.UserToken, clientIP net.IP,
			userAgent string) (bool, *auth.UserToken, error) {
			tryRotateCallCount++
			return false, nil, nil
		},
	}

	ctx, cancel := context.WithCancel(context.Background())
	reqContext, _, err := initTokenRotationScenario(ctx, t, ctxHdlr)
	require.NoError(t, err)
	reqContext.UserToken = &auth.UserToken{AuthToken: "oldtoken"}

	fn := ctxHdlr.rotateEndOfRequestFunc(reqContext)
	cancel()
	fn(reqContext.Resp)

	assert.Equal(t, 0, tryRotateCallCount, "Token rotation was attempted")
}

func TestTokenRotationAtEndOfRequest(t *testing.T) {
	ctxHdlr := getContextHandler(t)
	ctxHdlr.AuthTokenService = &authtest.FakeUserAuthTokenService{
		TryRotateTokenProvider: func(ctx context.Context, token *auth.UserToken, clientIP net.IP,
			userAgent string) (bool, *auth.UserToken, error) {
			newToken, err := util.RandomHex(16)
			require.NoError(t, err)
			token.AuthToken = newToken
			return true, token, nil
		},
	}

	reqContext, rr, err := initTokenRotationScenario(context.Background(), t, ctxHdlr)
	require.NoError(t, err)
	reqContext.UserToken = &auth.UserToken{AuthToken: "oldtoken"}

	ctxHdlr.rotateEndOfRequestFunc(reqContext)(reqContext.Resp)
	foundLoginCookie := false
	// nolint:bodyclose
	resp := rr.Result()
	t.Cleanup(func() {
		err := resp.Body.Close()
		assert.NoError(t, err)
	})
	for _, c := range resp.Cookies() {
		if c.Name == "login_token" {
			foundLoginCookie = true
			require.NotEqual(t, reqContext.UserToken.AuthToken, c.Value, "Auth token is still the same")
		}
	}

	assert.True(t, foundLoginCookie, "Could not find cookie")
}

func initTokenRotationScenario(ctx context.Context, t *testing.T, ctxHdlr *ContextHandler) (
	*contextmodel.ReqContext, *httptest.ResponseRecorder, error) {
	t.Helper()

	ctxHdlr.Cfg.LoginCookieName = "login_token"
	var err error
	ctxHdlr.Cfg.LoginMaxLifetime, err = gtime.ParseDuration("7d")
	if err != nil {
		return nil, nil, err
	}

	rr := httptest.NewRecorder()
	req, err := http.NewRequestWithContext(ctx, "", "", nil)
	if err != nil {
		return nil, nil, err
	}
	reqContext := &contextmodel.ReqContext{
		Context: &web.Context{Req: req},
		Logger:  log.New("testlogger"),
	}

	mw := mockWriter{rr}
	reqContext.Resp = mw

	return reqContext, rr, nil
}

type mockWriter struct {
	*httptest.ResponseRecorder
}

func (mw mockWriter) Flush()                {}
func (mw mockWriter) Status() int           { return 0 }
func (mw mockWriter) Size() int             { return 0 }
func (mw mockWriter) Written() bool         { return false }
func (mw mockWriter) Before(web.BeforeFunc) {}
func (mw mockWriter) Push(target string, opts *http.PushOptions) error {
	return nil
}
