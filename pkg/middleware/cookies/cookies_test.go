package cookies

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCookieOptions(t *testing.T) {
	rr := httptest.NewRecorder()

	expectedName := "cookie-name"
	expectedValue := "cookie-value"

	WriteCookie(rr, expectedName, expectedValue, 100, nil)

	cookie, err := http.ParseSetCookie(rr.Header().Get("Set-Cookie"))
	require.NoError(t, err)
	require.NotNil(t, cookie)

	require.Equal(t, expectedName, cookie.Name)
	require.Equal(t, expectedValue, cookie.Value)
	require.GreaterOrEqual(t, cookie.MaxAge, 0)

	// Does not override but appends to the `Set-Cookie` header.
	DeleteCookie(rr, expectedName, nil)

	cookieHeader := rr.Header().Values("Set-Cookie")
	require.Len(t, cookieHeader, 2)

	cookie, err = http.ParseSetCookie(cookieHeader[1])
	require.NoError(t, err)
	require.NotNil(t, cookie)
	require.NoError(t, cookie.Valid())
}
