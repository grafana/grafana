package csrf

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestMiddlewareCSRF(t *testing.T) {
	tests := []struct {
		name       string
		cookieName string
		method     string
		origin     string
		host       string
		code       int
	}{
		{
			name:       "mismatched origin and host is forbidden",
			cookieName: "foo",
			method:     "GET",
			origin:     "http://notLocalhost",
			host:       "localhost",
			code:       http.StatusForbidden,
		},
		{
			name:       "mismatched origin and host is NOT forbidden with a 'Safe Method'",
			cookieName: "foo",
			method:     "TRACE",
			origin:     "http://notLocalhost",
			host:       "localhost",
			code:       http.StatusOK,
		},
		{
			name:       "mismatched origin and host is NOT forbidden without a cookie",
			cookieName: "",
			method:     "GET",
			origin:     "http://notLocalhost",
			host:       "localhost",
			code:       http.StatusOK,
		},
		{
			name:       "malformed host is a bad request",
			cookieName: "foo",
			method:     "GET",
			host:       "localhost:80:80",
			code:       http.StatusBadRequest,
		},
		{
			name:       "host works without port",
			cookieName: "foo",
			method:     "GET",
			host:       "localhost",
			origin:     "http://localhost",
			code:       http.StatusOK,
		},
		{
			name:       "port does not have to match",
			cookieName: "foo",
			method:     "GET",
			host:       "localhost:80",
			origin:     "http://localhost:3000",
			code:       http.StatusOK,
		},
		{
			name:       "IPv6 host works with port",
			cookieName: "foo",
			method:     "GET",
			host:       "[::1]:3000",
			origin:     "http://[::1]:3000",
			code:       http.StatusOK,
		},
		{
			name:       "IPv6 host (with longer address) works with port",
			cookieName: "foo",
			method:     "GET",
			host:       "[2001:db8::1]:3000",
			origin:     "http://[2001:db8::1]:3000",
			code:       http.StatusOK,
		},
		{
			name:       "IPv6 host (with longer address) works without port",
			cookieName: "foo",
			method:     "GET",
			host:       "[2001:db8::1]",
			origin:     "http://[2001:db8::1]",
			code:       http.StatusOK,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := csrfScenario(t, tt.cookieName, tt.method, tt.origin, tt.host)
			require.Equal(t, tt.code, rr.Code)
		})
	}
}

func TestCSRF_Check(t *testing.T) {
	tests := []struct {
		name           string
		request        *http.Request
		addtHeader     map[string]struct{}
		trustedOrigins map[string]struct{}
		safeEndpoints  map[string]struct{}
		expectedOK     bool
		expectedStatus int
	}{
		{
			name:       "base case",
			request:    postRequest(t, "", nil),
			expectedOK: true,
		},
		{
			name:           "base with null origin header",
			request:        postRequest(t, "", map[string]string{"Origin": "null"}),
			expectedStatus: http.StatusForbidden,
		},
		{
			name:       "grafana.org",
			request:    postRequest(t, "grafana.org", map[string]string{"Origin": "https://grafana.org"}),
			expectedOK: true,
		},
		{
			name:           "grafana.org with X-Forwarded-Host",
			request:        postRequest(t, "grafana.localhost", map[string]string{"X-Forwarded-Host": "grafana.org", "Origin": "https://grafana.org"}),
			expectedStatus: http.StatusForbidden,
		},
		{
			name:       "grafana.org with X-Forwarded-Host and header trusted",
			request:    postRequest(t, "grafana.localhost", map[string]string{"X-Forwarded-Host": "grafana.org", "Origin": "https://grafana.org"}),
			addtHeader: map[string]struct{}{"X-Forwarded-Host": {}},
			expectedOK: true,
		},
		{
			name:           "grafana.org from grafana.com",
			request:        postRequest(t, "grafana.org", map[string]string{"Origin": "https://grafana.com"}),
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "grafana.org from grafana.com explicit trust for grafana.com",
			request:        postRequest(t, "grafana.org", map[string]string{"Origin": "https://grafana.com"}),
			trustedOrigins: map[string]struct{}{"grafana.com": {}},
			expectedOK:     true,
		},
		{
			name:           "grafana.org from grafana.com with X-Forwarded-Host and header trusted",
			request:        postRequest(t, "grafana.localhost", map[string]string{"X-Forwarded-Host": "grafana.org", "Origin": "https://grafana.com"}),
			addtHeader:     map[string]struct{}{"X-Forwarded-Host": {}},
			trustedOrigins: map[string]struct{}{"grafana.com": {}},
			expectedOK:     true,
		},
		{
			name:          "safe endpoint",
			request:       postRequest(t, "example.org/foo/bar", map[string]string{"Origin": "null"}),
			safeEndpoints: map[string]struct{}{"foo/bar": {}},
			expectedOK:    true,
		},
	}

	for _, tc := range tests {
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			c := CSRF{
				cfg:            setting.NewCfg(),
				trustedOrigins: tc.trustedOrigins,
				headers:        tc.addtHeader,
				safeEndpoints:  tc.safeEndpoints,
			}
			c.cfg.LoginCookieName = "LoginCookie"

			err := c.check(tc.request)
			if tc.expectedOK {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				var actual *errorWithStatus
				require.True(t, errors.As(err, &actual))
				assert.EqualValues(t, tc.expectedStatus, actual.HTTPStatus)
			}
		})
	}
}

func postRequest(t testing.TB, hostname string, headers map[string]string) *http.Request {
	t.Helper()
	urlParts := strings.SplitN(hostname, "/", 2)

	path := "/"
	if len(urlParts) == 2 {
		path = urlParts[1]
	}
	r, err := http.NewRequest(http.MethodPost, path, nil)
	require.NoError(t, err)

	r.Host = urlParts[0]

	r.AddCookie(&http.Cookie{
		Name:  "LoginCookie",
		Value: "this should not be important",
	})

	for k, v := range headers {
		r.Header.Set(k, v)
	}
	return r
}

func csrfScenario(t *testing.T, cookieName, method, origin, host string) *httptest.ResponseRecorder {
	req, err := http.NewRequest(method, "/", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{
		Name: cookieName,
	})

	// Note: Not sure where host header populates req.Host, or how that works.
	req.Host = host
	req.Header.Set("HOST", host)

	req.Header.Set("ORIGIN", origin)

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

	})

	rr := httptest.NewRecorder()
	cfg := setting.NewCfg()
	cfg.LoginCookieName = cookieName
	service := ProvideCSRFFilter(cfg)
	handler := service.Middleware()(testHandler)
	handler.ServeHTTP(rr, req)
	return rr
}
