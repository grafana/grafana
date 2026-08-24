package pluginmanifest

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func newCustomRouteRequest(method, rawURL string, headers http.Header, body string) *app.CustomRouteRequest {
	u, _ := url.Parse(rawURL)
	var rc io.ReadCloser
	if body != "" {
		rc = io.NopCloser(strings.NewReader(body))
	}
	return &app.CustomRouteRequest{
		Path:    u.Path,
		URL:     u,
		Method:  method,
		Headers: headers,
		Body:    rc,
	}
}

func newCustomRouteApp(c *fakeClient, ctxErr error) *pluginBackendApp {
	return newPluginBackendApp("test-app", c, fakeContextGetter{err: ctxErr})
}

func TestPluginBackendApp_CallCustomRoute(t *testing.T) {
	const fullPath = "/apis/testapp.ext.grafana.com/v1/namespaces/default/things/t1/customroute"

	t.Run("forwards full path, method, headers, body, and query; writes response", func(t *testing.T) {
		c := &fakeClient{callResource: func(_ context.Context, _ *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			return sender.Send(&backend.CallResourceResponse{
				Status:  http.StatusCreated,
				Headers: map[string][]string{"X-Test": {"yes"}},
				Body:    []byte("hello"),
			})
		}}
		a := newCustomRouteApp(c, nil)

		rec := httptest.NewRecorder()
		hdr := http.Header{"X-Custom": []string{"v"}}
		err := a.CallCustomRoute(context.Background(), rec, newCustomRouteRequest(http.MethodPost, fullPath+"?a=1&b=2", hdr, "payload"))
		require.NoError(t, err)

		// Full path forwarded (not a stripped subsegment).
		require.Equal(t, fullPath, c.lastCRReq.Path)
		require.Equal(t, http.MethodPost, c.lastCRReq.Method)
		require.Equal(t, []string{"v"}, c.lastCRReq.Headers["X-Custom"])
		require.Equal(t, []byte("payload"), c.lastCRReq.Body)
		// Query preserved in URL.
		require.Contains(t, c.lastCRReq.URL, "a=1&b=2")

		// Response written through to the recorder.
		require.Equal(t, http.StatusCreated, rec.Code)
		require.Equal(t, "yes", rec.Header().Get("X-Test"))
		require.Equal(t, "hello", rec.Body.String())
	})

	t.Run("plugin context error -> returned, backend never called, nothing written", func(t *testing.T) {
		c := &fakeClient{callResource: func(_ context.Context, _ *backend.CallResourceRequest, _ backend.CallResourceResponseSender) error {
			return nil
		}}
		a := newCustomRouteApp(c, errors.New("not registered"))

		rec := httptest.NewRecorder()
		err := a.CallCustomRoute(context.Background(), rec, newCustomRouteRequest(http.MethodGet, fullPath, nil, ""))
		require.Error(t, err)
		require.Contains(t, err.Error(), "not registered")
		require.False(t, c.crCalled)
		require.Equal(t, 200, rec.Code) // recorder default; WriteHeader never called
		require.Empty(t, rec.Body.String())
	})

	t.Run("nil body handled", func(t *testing.T) {
		c := &fakeClient{callResource: func(_ context.Context, _ *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			return sender.Send(&backend.CallResourceResponse{Status: http.StatusOK, Body: []byte("ok")})
		}}
		a := newCustomRouteApp(c, nil)

		rec := httptest.NewRecorder()
		err := a.CallCustomRoute(context.Background(), rec, newCustomRouteRequest(http.MethodGet, fullPath, nil, ""))
		require.NoError(t, err)
		require.Empty(t, c.lastCRReq.Body)
		require.Equal(t, http.StatusOK, rec.Code)
	})

	t.Run("error before any send -> returned, recorder untouched", func(t *testing.T) {
		boom := errors.New("backend boom")
		c := &fakeClient{callResource: func(_ context.Context, _ *backend.CallResourceRequest, _ backend.CallResourceResponseSender) error {
			return boom
		}}
		a := newCustomRouteApp(c, nil)

		rec := httptest.NewRecorder()
		err := a.CallCustomRoute(context.Background(), rec, newCustomRouteRequest(http.MethodGet, fullPath, nil, ""))
		require.ErrorIs(t, err, boom)
		require.Equal(t, 200, rec.Code)
		require.Empty(t, rec.Body.String())
	})

	t.Run("error after response started -> swallowed, response preserved (no double write)", func(t *testing.T) {
		c := &fakeClient{callResource: func(_ context.Context, _ *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			if err := sender.Send(&backend.CallResourceResponse{Status: http.StatusOK, Body: []byte("partial")}); err != nil {
				return err
			}
			return errors.New("late failure")
		}}
		a := newCustomRouteApp(c, nil)

		rec := httptest.NewRecorder()
		err := a.CallCustomRoute(context.Background(), rec, newCustomRouteRequest(http.MethodGet, fullPath, nil, ""))
		require.NoError(t, err) // swallowed because a response was already sent
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "partial", rec.Body.String())
	})
}
