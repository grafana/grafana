package api

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func TestHooks(t *testing.T) {
	t.Run("Hooks", func(t *testing.T) {
		t.Run("yields handlers for paths with hooks", func(t *testing.T) {
			hooks := NewHooks(log.NewNopLogger())
			invoked := false
			hook := func(*contextmodel.ReqContext) response.Response { invoked = true; return nil }

			hooks.Set("GET", "/some/path", hook)
			reqURL, _ := url.Parse("http://domain.test/some/path")
			handler, ok := hooks.Get("GET", reqURL)

			require.True(t, ok, "hooks did not contain a matching hook for path")
			require.False(t, invoked, "hook was invoked earlier than expected")
			handler(nil)
			require.True(t, invoked, "the hook returned by get() was not invoked as expected")
		})

		t.Run("yields no handlers for paths without hooks", func(t *testing.T) {
			hooks := NewHooks(log.NewNopLogger())
			hook := func(*contextmodel.ReqContext) response.Response { return nil }

			hooks.Set("GET", "/some/path", hook)
			reqURL, _ := url.Parse("http://domain.test/does/not/match")
			handler, ok := hooks.Get("GET", reqURL)

			require.False(t, ok, "hooks returned a hook when we expected it not to")
			require.Nil(t, handler)
		})

		t.Run("hooks do not match routes with additional subpaths", func(t *testing.T) {
			hooks := NewHooks(log.NewNopLogger())
			hook := func(*contextmodel.ReqContext) response.Response { return nil }

			hooks.Set("GET", "/some/path", hook)
			reqURL, _ := url.Parse("http://domain.test/some/path/with/more")
			handler, ok := hooks.Get("GET", reqURL)

			require.False(t, ok, "hooks returned a hook when we expected it not to")
			require.Nil(t, handler)
		})

		t.Run("hooks do not match requests with the wrong HTTP method", func(t *testing.T) {
			hooks := NewHooks(log.NewNopLogger())
			hook := func(*contextmodel.ReqContext) response.Response { return nil }

			hooks.Set("POST", "/some/path", hook)
			reqURL, _ := url.Parse("http://domain.test/some/path")
			handler, ok := hooks.Get("GET", reqURL)

			require.False(t, ok, "hooks returned a hook when we expected it not to")
			require.Nil(t, handler)
		})

		t.Run("hooks match routes with query parameters", func(t *testing.T) {
			hooks := NewHooks(log.NewNopLogger())
			invoked := false
			hook := func(*contextmodel.ReqContext) response.Response { invoked = true; return nil }

			hooks.Set("GET", "/some/path", hook)
			reqURL, _ := url.Parse("http://domain.test/some/path?query=param")
			handler, ok := hooks.Get("GET", reqURL)

			require.True(t, ok, "hooks did not contain a matching hook for path")
			require.False(t, invoked, "hook was invoked earlier than expected")
			handler(nil)
			require.True(t, invoked, "the hook returned by get() was not invoked as expected")
		})

		t.Run("hooks match routes with path variables", func(t *testing.T) {
			hooks := NewHooks(log.NewNopLogger())
			invoked := false
			hook := func(*contextmodel.ReqContext) response.Response { invoked = true; return nil }

			hooks.Set("GET", "/some/{value}", hook)
			reqURL, _ := url.Parse("http://domain.test/some/123")
			handler, ok := hooks.Get("GET", reqURL)

			require.True(t, ok, "hooks did not contain a matching hook for path")
			require.False(t, invoked, "hook was invoked earlier than expected")
			handler(nil)
			require.True(t, invoked, "the hook returned by get() was not invoked as expected")
		})
	})

	t.Run("Wrap", func(t *testing.T) {
		t.Run("invokes hooks if one is defined", func(t *testing.T) {
			defaultInvoked := false
			defaultHandler := func(*contextmodel.ReqContext) response.Response { defaultInvoked = true; return nil }
			hookInvoked := false
			hookHandler := func(*contextmodel.ReqContext) response.Response { hookInvoked = true; return nil }
			hooks := NewHooks(log.NewNopLogger())
			hooks.Set("GET", "/some/path", hookHandler)

			composed := hooks.Wrap(defaultHandler)
			req := createReqForTests("GET", "http://domain.test/some/path")
			composed(req)

			require.True(t, hookInvoked, "hook was expected to be invoked, but it was not")
			require.False(t, defaultInvoked, "default handler was invoked, but it should not have been")
		})

		t.Run("does not invoke hooks if path has none defined", func(t *testing.T) {
			defaultInvoked := false
			defaultHandler := func(*contextmodel.ReqContext) response.Response { defaultInvoked = true; return nil }
			hookInvoked := false
			hookHandler := func(*contextmodel.ReqContext) response.Response { hookInvoked = true; return nil }
			hooks := NewHooks(log.NewNopLogger())
			hooks.Set("GET", "/some/path", hookHandler)

			composed := hooks.Wrap(defaultHandler)
			req := createReqForTests("GET", "http://domain.test/does/not/match")
			composed(req)

			require.False(t, hookInvoked, "hook was invoked, but it should not have been")
			require.True(t, defaultInvoked, "default handler was expected to be invoked, but it was not")
		})
	})
}

func createReqForTests(method, setupURL string) *contextmodel.ReqContext {
	reqURL, _ := url.Parse(setupURL)
	return &contextmodel.ReqContext{
		Context: &web.Context{
			Req: &http.Request{
				Method: method,
				URL:    reqURL,
			},
		},
	}
}
