package httpclientprovider

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana-aws-sdk/pkg/sigv4"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
)

func TestSigV4Middleware(t *testing.T) {
	t.Run("Without sigv4 options set should return next http.RoundTripper", func(t *testing.T) {
		origSigV4Func := newSigV4Func
		newSigV4Called := false
		middlewareCalled := false
		newSigV4Func = func(config *sigv4.Config, next http.RoundTripper, opts ...sigv4.Opts) (http.RoundTripper, error) {
			newSigV4Called = true
			return httpclient.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
				middlewareCalled = true
				return next.RoundTrip(r)
			}), nil
		}
		t.Cleanup(func() {
			newSigV4Func = origSigV4Func
		})

		ctx := &testContext{}
		finalRoundTripper := ctx.createRoundTripper("finalrt")
		mw := SigV4Middleware(false)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, SigV4MiddlewareName, middlewareName.MiddlewareName())

		req, err := http.NewRequest(http.MethodGet, "http://", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}
		require.Len(t, ctx.callChain, 1)
		require.ElementsMatch(t, []string{"finalrt"}, ctx.callChain)
		require.False(t, newSigV4Called)
		require.False(t, middlewareCalled)
	})

	t.Run("With sigv4 options set should call sigv4 http.RoundTripper", func(t *testing.T) {
		origSigV4Func := newSigV4Func
		newSigV4Called := false
		middlewareCalled := false
		newSigV4Func = func(config *sigv4.Config, next http.RoundTripper, opts ...sigv4.Opts) (http.RoundTripper, error) {
			newSigV4Called = true
			return httpclient.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
				middlewareCalled = true
				return next.RoundTrip(r)
			}), nil
		}
		t.Cleanup(func() {
			newSigV4Func = origSigV4Func
		})

		ctx := &testContext{}
		finalRoundTripper := ctx.createRoundTripper("final")
		mw := SigV4Middleware(false)
		rt := mw.CreateMiddleware(httpclient.Options{SigV4: &httpclient.SigV4Config{}}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, SigV4MiddlewareName, middlewareName.MiddlewareName())

		req, err := http.NewRequest(http.MethodGet, "http://", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}
		require.Len(t, ctx.callChain, 1)
		require.ElementsMatch(t, []string{"final"}, ctx.callChain)

		require.True(t, newSigV4Called)
		require.True(t, middlewareCalled)
	})

	t.Run("With sigv4 error returned", func(t *testing.T) {
		origSigV4Func := newSigV4Func
		newSigV4Func = func(config *sigv4.Config, next http.RoundTripper, opts ...sigv4.Opts) (http.RoundTripper, error) {
			return nil, fmt.Errorf("problem")
		}
		t.Cleanup(func() {
			newSigV4Func = origSigV4Func
		})

		ctx := &testContext{}
		finalRoundTripper := ctx.createRoundTripper("final")
		mw := SigV4Middleware(false)
		rt := mw.CreateMiddleware(httpclient.Options{SigV4: &httpclient.SigV4Config{}}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, SigV4MiddlewareName, middlewareName.MiddlewareName())

		req, err := http.NewRequest(http.MethodGet, "http://", nil)
		require.NoError(t, err)
		// response is nil
		// nolint:bodyclose
		res, err := rt.RoundTrip(req)
		require.Error(t, err)
		require.Nil(t, res)
		require.Empty(t, ctx.callChain)
	})
}
