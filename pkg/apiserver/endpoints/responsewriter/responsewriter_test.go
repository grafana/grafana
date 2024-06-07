package responsewriter_test

import (
	"context"
	"io"
	"math/rand"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

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
		close(client.Transport.(*roundTripperFunc).ready)
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
		close(client.Transport.(*roundTripperFunc).ready)
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
		close(client.Transport.(*roundTripperFunc).ready)
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

	t.Run("should handle asynchronous err - stdlib", func(t *testing.T) {
		l, err := net.Listen("tcp", "127.0.0.1:0")
		require.NoError(t, err)

		server := &http.Server{
			Handler: http.HandlerFunc(asyncErrHandler),
		}

		serverDone := make(chan struct{})
		go func() {
			defer close(serverDone)
			err := server.Serve(l)
			require.ErrorIs(t, err, http.ErrServerClosed)
		}()

		resp, err := http.Get("http://" + l.Addr().String() + "/test?watch=true")
		require.NoError(t, err)
		defer func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		}()

		require.Equal(t, http.StatusInternalServerError, resp.StatusCode)

		err = server.Shutdown(context.Background())
		require.NoError(t, err)
		<-serverDone
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
	w.Write([]byte("error"))
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
