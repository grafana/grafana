package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/stretchr/testify/require"
)

func TestMiddlewareCSRF(t *testing.T) {
	req, err := http.NewRequest("GET", "/", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{
		Name: "foo",
	})

	req.Header.Add("ORIGIN", "localhost")
	req.Header.Add("HOST", "notLocalhost")

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

	})

	rr := httptest.NewRecorder()
	handler := CSRF("foo")(testHandler)
	handler.ServeHTTP(rr, req)
	spew.Dump(rr.Body)
	require.Equal(t, rr.Code, http.StatusForbidden)
}
