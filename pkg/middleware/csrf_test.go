package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMiddlewareCSRF(t *testing.T) {
	rr := csrfScenario(t, "foo", "localhost", "notLocalhost", "80")
	require.Equal(t, rr.Code, http.StatusForbidden)
}

func csrfScenario(t *testing.T, cookieName, origin, host, defaultPort string) *httptest.ResponseRecorder {
	req, err := http.NewRequest("GET", "/", nil)
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
