package responsewriter_test

import (
	"context"
	"io"
	"math/rand"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"

	grafanaresponsewriter "github.com/grafana/grafana/pkg/apiserver/endpoints/responsewriter"
)

func TestResponseAdapter(t *testing.T) {
	t.Run("should handle synchronous write", func(t *testing.T) {
		client := &http.Client{
			Transport: &roundTripperFunc{
				ready: make(chan struct{}),
				// ignore the lint error because the response is passed directly to the client,
				// so the client will be responsible for closing the response body.
				//nolint:bodyclose
				fn: grafanaresponsewriter.WrapHandler(http.HandlerFunc(syncHandler)),
			},
		}
		req, err := http.NewRequest("GET", "http://localhost/test", nil)
		require.NoError(t, err)

		resp, err := client.Do(req)
		require.NoError(t, err)

		defer func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		}()

		bodyBytes, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, "OK", string(bodyBytes))
	})

	t.Run("should handle asynchronous write", func(t *testing.T) {
		generateRandomStrings(10)
		client := &http.Client{
			Transport: &roundTripperFunc{
				ready: make(chan struct{}),
				// ignore the lint error because the response is passed directly to the client,
				// so the client will be responsible for closing the response body.
				//nolint:bodyclose
				fn: grafanaresponsewriter.WrapHandler(http.HandlerFunc(asyncHandler)),
			},
		}
		req, err := http.NewRequest("GET", "http://localhost/test?watch=true", nil)
		require.NoError(t, err)

		resp, err := client.Do(req)
		require.NoError(t, err)

		defer func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		}()

		// ensure that watch request is a 200
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// limit to 100 bytes to test the reader buffer
		buf := make([]byte, 100)
		// holds the read bytes between iterations
		cache := []byte{}

		for i := 0; i < 10; {
			n, err := resp.Body.Read(buf)
			require.NoError(t, err)
			if n == 0 {
				continue
			}
			cache = append(cache, buf[:n]...)

			if len(cache) >= len(randomStrings[i]) {
				str := cache[:len(randomStrings[i])]
				require.Equal(t, randomStrings[i], string(str))
				cache = cache[len(randomStrings[i]):]
				i++
			}
		}
	})

	t.Run("should handle asynchronous err", func(t *testing.T) {
		client := &http.Client{
			Transport: &roundTripperFunc{
				ready: make(chan struct{}),
				// ignore the lint error because the response is passed directly to the client,
				// so the client will be responsible for closing the response body.
				//nolint:bodyclose
				fn: grafanaresponsewriter.WrapHandler(http.HandlerFunc(asyncErrHandler)),
			},
		}
		req, err := http.NewRequest("GET", "http://localhost/test?watch=true", nil)
		require.NoError(t, err)

		resp, err := client.Do(req)
		require.NoError(t, err)

		defer func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		}()

		require.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("should handle context cancellation", func(t *testing.T) {
		var cancel context.CancelFunc
		client := &http.Client{
			Transport: &roundTripperFunc{
				ready: make(chan struct{}),
				// ignore the lint error because the response is passed directly to the client,
				// so the client will be responsible for closing the response body.
				//nolint:bodyclose
				fn: grafanaresponsewriter.WrapHandler(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
					cancel()
				})),
			},
		}
		req, err := http.NewRequest("GET", "http://localhost/test?watch=true", nil)
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(req.Context()) //nolint:govet
		req = req.WithContext(ctx)
		resp, err := client.Do(req) //nolint:bodyclose
		require.Nil(t, resp)
		require.Error(t, err)
		require.ErrorIs(t, err, context.Canceled)
	}) //nolint:govet

	t.Run("should gracefully handle concurrent WriteHeader calls", func(t *testing.T) {
		t.Parallel()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		const maxAttempts = 1000
		var wg sync.WaitGroup
		for i := 0; i < maxAttempts; i++ {
			ra := grafanaresponsewriter.NewAdapter(req)
			wg.Add(2)
			go func() {
				defer wg.Done()
				ra.WriteHeader(http.StatusOK)
			}()
			go func() {
				defer wg.Done()
				ra.WriteHeader(http.StatusOK)
			}()
		}
		wg.Wait()
	})

	t.Run("should fork the context", func(t *testing.T) {
		t.Parallel()

		type K int
		var key K
		baseCtx := context.Background()
		baseCtx = context.WithValue(baseCtx, key, "hello, world!") // we expect this one not to be sent to the inner handler.

		expectedUsr := &user.DefaultInfo{Name: "hello, world!"}
		baseCtx = request.WithUser(baseCtx, expectedUsr)
		// There are more keys to consider, but this should be sufficient to decide that we do actually propagate select data across.

		client := &http.Client{
			Transport: &roundTripperFunc{
				ready: make(chan struct{}),
				// ignore the lint error because the response is passed directly to the client,
				// so the client will be responsible for closing the response body.
				//nolint:bodyclose
				fn: grafanaresponsewriter.WrapHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					require.Nil(t, r.Context().Value(key), "inner handler should not have a value for key of type K")
					usr, ok := request.UserFrom(r.Context())
					require.True(t, ok, "no user found in request context")
					require.Equal(t, expectedUsr.Name, usr.GetName(), "user data was not propagated through request context")

					_, err := w.Write([]byte("OK"))
					require.NoError(t, err)
				})),
			},
		}

		req, err := http.NewRequestWithContext(baseCtx, http.MethodGet, "/", nil)
		require.NoError(t, err)

		resp, err := client.Do(req)
		require.NoError(t, err, "request should not fail")
		require.NoError(t, resp.Body.Close())
	})
}

func syncHandler(w http.ResponseWriter, r *http.Request) {
	_, _ = w.Write([]byte("OK"))
}

func asyncHandler(w http.ResponseWriter, r *http.Request) {
	for _, s := range randomStrings {
		time.Sleep(100 * time.Millisecond)
		// write the current iteration
		_, _ = w.Write([]byte(s))
		w.(http.Flusher).Flush()
	}
}

func asyncErrHandler(w http.ResponseWriter, _ *http.Request) {
	time.Sleep(100 * time.Millisecond)
	w.WriteHeader(http.StatusInternalServerError)
	_, _ = w.Write([]byte("error"))
	w.(http.Flusher).Flush()
}

var randomStrings = []string{}

func generateRandomStrings(n int) {
	for i := 0; i < n; i++ {
		randomString := generateRandomString(1000 * (i + 1))
		randomStrings = append(randomStrings, randomString)
	}
}

func generateRandomString(n int) string {
	gen := rand.New(rand.NewSource(time.Now().UnixNano()))
	var chars = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
	b := make([]rune, n)
	for i := range b {
		b[i] = chars[gen.Intn(len(chars))]
	}
	return string(b)
}

type roundTripperFunc struct {
	ready chan struct{}
	fn    func(req *http.Request) (*http.Response, error)
}

func (f *roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	if f.fn == nil {
		<-f.ready
	}
	res, err := f.fn(req)
	return res, err
}
