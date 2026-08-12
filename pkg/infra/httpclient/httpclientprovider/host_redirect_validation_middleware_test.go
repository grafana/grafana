package httpclientprovider

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
)

func TestRedirectLimitMiddleware(t *testing.T) {
	t.Parallel()

	t.Run("when the server responds with a status code 3xx", func(t *testing.T) {
		t.Parallel()

		t.Run("but there is no Location header in the response, then the response is not validated", func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusTemporaryRedirect)
			}))
			t.Cleanup(server.Close)

			mw := RedirectLimitMiddleware(&fakeValidator{err: errors.New("this wont be called")})
			rt := mw.CreateMiddleware(httpclient.Options{}, http.DefaultTransport)
			require.NotNil(t, rt)

			middlewareName, ok := mw.(httpclient.MiddlewareName)
			require.True(t, ok)
			require.Equal(t, HostRedirectValidationMiddlewareName, middlewareName.MiddlewareName())

			req, err := http.NewRequest(http.MethodGet, server.URL, nil)
			require.NoError(t, err)

			res, err := rt.RoundTrip(req)
			require.NoError(t, err)
			require.NotNil(t, res)

			if res.Body != nil {
				require.NoError(t, res.Body.Close())
			}
		})

		t.Run("and there is a Location header in the response", func(t *testing.T) {
			t.Parallel()

			t.Run("but the validation function fails, it returns the validation error", func(t *testing.T) {
				t.Parallel()

				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Location", "http://www.example.com")
					w.WriteHeader(http.StatusTemporaryRedirect)
				}))
				t.Cleanup(server.Close)

				fakeErr := errors.New("fake error")

				mw := RedirectLimitMiddleware(&fakeValidator{err: fakeErr})
				rt := mw.CreateMiddleware(httpclient.Options{}, http.DefaultTransport)
				require.NotNil(t, rt)

				middlewareName, ok := mw.(httpclient.MiddlewareName)
				require.True(t, ok)
				require.Equal(t, HostRedirectValidationMiddlewareName, middlewareName.MiddlewareName())

				req, err := http.NewRequest(http.MethodGet, server.URL, nil)
				require.NoError(t, err)

				res, err := rt.RoundTrip(req)
				require.ErrorIs(t, err, fakeErr)
				require.Nil(t, res)

				if res != nil && res.Body != nil {
					require.NoError(t, res.Body.Close())
				}
			})

			t.Run("and the validation function succeeds, it returns the response", func(t *testing.T) {
				t.Parallel()

				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Location", "http://www.example.com")
					w.WriteHeader(http.StatusTemporaryRedirect)
				}))
				t.Cleanup(server.Close)

				mw := RedirectLimitMiddleware(&fakeValidator{})
				rt := mw.CreateMiddleware(httpclient.Options{}, http.DefaultTransport)
				require.NotNil(t, rt)

				middlewareName, ok := mw.(httpclient.MiddlewareName)
				require.True(t, ok)
				require.Equal(t, HostRedirectValidationMiddlewareName, middlewareName.MiddlewareName())

				req, err := http.NewRequest(http.MethodGet, server.URL, nil)
				require.NoError(t, err)

				res, err := rt.RoundTrip(req)
				require.NoError(t, err)
				require.NotNil(t, res)

				if res.Body != nil {
					require.NoError(t, res.Body.Close())
				}
			})
		})
	})
}

type fakeValidator struct {
	err error
}

func (v *fakeValidator) Validate(_ string) error { return v.err }
