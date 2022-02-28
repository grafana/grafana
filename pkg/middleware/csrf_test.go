package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMiddlewareCSRF(t *testing.T) {
	tests := []struct {
		name        string
		cookieName  string
		method      string
		origin      string
		host        string
		defaultPort string
		code        int
	}{
		{
			name:        "mismatched origin and host is forbidden",
			cookieName:  "foo",
			method:      "GET",
			origin:      "notLocalhost",
			host:        "localhost",
			defaultPort: "80",
			code:        http.StatusForbidden,
		},
		{
			name:        "mismatched origin and host is NOT forbidden with a 'Safe Method'",
			cookieName:  "foo",
			method:      "TRACE",
			origin:      "notLocalhost",
			host:        "localhost",
			defaultPort: "80",
			code:        http.StatusOK,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := csrfScenario(t, tt.cookieName, tt.method, tt.host, tt.origin, tt.defaultPort)
			require.Equal(t, rr.Code, tt.code)
		})
	}

}

func csrfScenario(t *testing.T, cookieName, method, origin, host, defaultPort string) *httptest.ResponseRecorder {
	req, err := http.NewRequest(method, "/", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{
		Name: cookieName,
	})

	req.Header.Add("ORIGIN", origin)
	req.Header.Add("HOST", host)

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

	})

	rr := httptest.NewRecorder()
	handler := CSRF(cookieName, defaultPort)(testHandler)
	handler.ServeHTTP(rr, req)
	return rr
}
