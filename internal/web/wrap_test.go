package web

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	grafanaweb "github.com/grafana/grafana/pkg/web"
)

func TestWrapHandlerHTTP(t *testing.T) {
	called := false
	h := WrapHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusTeapot)
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	require.True(t, called)
	require.Equal(t, http.StatusTeapot, rec.Code)
}

func TestWrapHandlerReqContextResponse(t *testing.T) {
	m := grafanaweb.New()
	var got string

	m.Use(func(c *grafanaweb.Context) {
		rc := &contextmodel.ReqContext{Context: c}
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), rc))
	})
	m.Use(func(c *contextmodel.ReqContext) response.Response {
		got = c.Req.URL.Path
		return response.JSON(http.StatusOK, map[string]string{"ok": "yes"})
	})
	m.Get("/x", func(http.ResponseWriter, *http.Request) {})

	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	require.Equal(t, "/x", got)
	require.Equal(t, http.StatusOK, rec.Code)
}

func TestWrapHandlerUnknownPanics(t *testing.T) {
	require.Panics(t, func() {
		WrapHandler(42)
	})
}
