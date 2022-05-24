package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

func TestMiddlewareCSRF(t *testing.T) {
	tests := []struct {
		name       string
		cookieName string
		method     string
		origin     string
		host       string
		proxyHostHeader string
		proxyHostHeaderValue string
		code       int
	}{
		{
			name:       "mismatched origin and host is forbidden",
			cookieName: "foo",
			method:     "GET",
			origin:     "http://notLocalhost",
			host:       "localhost",
			proxyHostHeader: "",
			proxyHostHeaderValue: "bar",
			code:       http.StatusForbidden,
		},
		{
			name:       "mismatched origin and host is NOT forbidden with a 'Safe Method'",
			cookieName: "foo",
			method:     "TRACE",
			origin:     "http://notLocalhost",
			host:       "localhost",
			proxyHostHeader: "",
			proxyHostHeaderValue: "bar",
			code:       http.StatusOK,
		},
		{
			name:       "mismatched origin and host is NOT forbidden without a cookie",
			cookieName: "",
			method:     "GET",
			origin:     "http://notLocalhost",
			host:       "localhost",
			proxyHostHeader: "",
			proxyHostHeaderValue: "bar",
			code:       http.StatusOK,
		},
		{
			name:       "malformed host is a bad request",
			cookieName: "foo",
			method:     "GET",
			host:       "localhost:80:80",
			proxyHostHeader: "",
			proxyHostHeaderValue: "bar",
			code:       http.StatusBadRequest,
		},
		{
			name:       "host works without port",
			cookieName: "foo",
			method:     "GET",
			host:       "localhost",
			proxyHostHeader: "",
			proxyHostHeaderValue: "bar",
			origin:     "http://localhost",
			code:       http.StatusOK,
		},
		{
			name:       "port does not have to match",
			cookieName: "foo",
			method:     "GET",
			host:       "localhost:80",
			proxyHostHeader: "",
			proxyHostHeaderValue: "bar",
			origin:     "http://localhost:3000",
			code:       http.StatusOK,
		},
		{
			name:       "IPv6 host works with port",
			cookieName: "foo",
			method:     "GET",
			host:       "[::1]:3000",
			proxyHostHeader: "",
			proxyHostHeaderValue: "bar",
			origin:     "http://[::1]:3000",
			code:       http.StatusOK,
		},
		{
			name:       "IPv6 host (with longer address) works with port",
			cookieName: "foo",
			method:     "GET",
			host:       "[2001:db8::1]:3000",
			proxyHostHeader: "",
			proxyHostHeaderValue: "bar",
			origin:     "http://[2001:db8::1]:3000",
			code:       http.StatusOK,
		},
		{
			name:       "IPv6 host (with longer address) works without port",
			cookieName: "foo",
			method:     "GET",
			host:       "[2001:db8::1]",
			proxyHostHeader: "",
			proxyHostHeaderValue: "bar",
			origin:     "http://[2001:db8::1]",
			code:       http.StatusOK,
		},
		{
			name:       "proxy host overrides host header when set",
			cookieName: "foo",
			method:     "GET",
			host:       "notLocalhost",
			proxyHostHeader: "X-Forwarded-Host",
			proxyHostHeaderValue: "localhost",
			origin:     "http://localhost",
			code:       http.StatusOK,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := csrfScenario(t, tt.cookieName, tt.method, tt.origin, tt.host, tt.proxyHostHeader, tt.proxyHostHeaderValue)
			require.Equal(t, tt.code, rr.Code)
		})
	}
}

func csrfScenario(t *testing.T, cookieName, method, origin, host, proxyHostHeader, proxyHostHeaderValue string) *httptest.ResponseRecorder {
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
	req.Header.Set(proxyHostHeader, proxyHostHeaderValue)

	req.Header.Set("ORIGIN", origin)

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

	})

	rr := httptest.NewRecorder()
	handler := CSRF(cookieName, proxyHostHeader, log.New())(testHandler)
	handler.ServeHTTP(rr, req)
	return rr
}
