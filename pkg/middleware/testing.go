package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type scenarioContext struct {
	t                *testing.T
	m                *web.Mux
	context          *contextmodel.ReqContext
	resp             *httptest.ResponseRecorder
	respJson         map[string]any
	handlerFunc      handlerFunc
	defaultHandler   web.Handler
	url              string
	authnService     *authntest.FakeService
	userService      *usertest.FakeUserService
	settingsProvider setting.SettingsProvider

	req *http.Request
}

// set identity to use for request
func (sc *scenarioContext) withIdentity(identity *authn.Identity) {
	sc.authnService.ExpectedErr = nil
	sc.authnService.ExpectedIdentity = identity
}

func (sc *scenarioContext) fakeReq(method, url string) *scenarioContext {
	sc.t.Helper()

	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(method, url, nil)
	require.NoError(sc.t, err)

	reqCtx := &contextmodel.ReqContext{
		Context: web.FromContext(req.Context()),
	}
	sc.req = req.WithContext(ctxkey.Set(req.Context(), reqCtx))

	return sc
}

func (sc *scenarioContext) fakeReqWithParams(method, url string, queryParams map[string]string) *scenarioContext {
	sc.t.Helper()

	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(method, url, nil)
	require.NoError(sc.t, err)

	q := req.URL.Query()
	for k, v := range queryParams {
		q.Add(k, v)
	}

	req.URL.RawQuery = q.Encode()
	req.RequestURI = req.URL.RequestURI()

	require.NoError(sc.t, err)

	reqCtx := &contextmodel.ReqContext{
		Context: web.FromContext(req.Context()),
	}
	sc.req = req.WithContext(ctxkey.Set(req.Context(), reqCtx))

	return sc
}

func (sc *scenarioContext) exec() {
	sc.t.Helper()

	sc.m.ServeHTTP(sc.resp, sc.req)

	if sc.resp.Header().Get("Content-Type") == "application/json; charset=UTF-8" {
		err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
		require.NoError(sc.t, err)
		sc.t.Log("Decoded JSON", "json", sc.respJson)
	} else {
		sc.t.Log("Not decoding JSON")
	}
}

type (
	scenarioFunc func(t *testing.T, c *scenarioContext)
	handlerFunc  func(c *contextmodel.ReqContext)
)
