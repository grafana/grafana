package rendering

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type trackedBody struct {
	io.Reader
	closed bool
}

func (b *trackedBody) Close() error { b.closed = true; return nil }

func TestRenderResponseFailures(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		body   string
		want   error
	}{
		{"rate limit", 429, "", ErrTooManyRequests},
		{"renderer timeout", 408, "", ErrServerTimeout},
		{"renderer failure", 500, "failure", nil},
		{"oversized response", 200, "12345", ErrResultTooLarge},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := &trackedBody{Reader: strings.NewReader(tc.body)}
			keys := &testKeys{}
			s, err := NewService(Config{
				Renderer: ImageRendererConfig{URL: "https://renderer", AuthToken: "renderer-secret"},
				Settings: func(context.Context) (Settings, error) {
					return Settings{CallbackURL: "https://grafana"}, nil
				},
				Keys: keys, Store: MemoryStore{MaxBytes: 4},
				Client: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
					return &http.Response{StatusCode: tc.status, Body: body}, nil
				})},
			})
			require.NoError(t, err)
			result, err := s.Render(t.Context(), RenderPNG, Opts{CommonOpts: CommonOpts{TimeoutOpts: TimeoutOpts{Timeout: time.Second}}})
			require.Error(t, err)
			if tc.want != nil {
				require.ErrorIs(t, err, tc.want)
			}
			require.Nil(t, result)
			require.True(t, body.closed)
			require.EqualValues(t, 1, keys.released.Load())
			require.Empty(t, s.limiter.(*LocalConcurrencyLimiter).inProgress)
		})
	}
}

func TestMemoryStoreBounds(t *testing.T) {
	for _, body := range []string{"", "123", "1234"} {
		result, err := (MemoryStore{MaxBytes: 4}).Store(t.Context(), RenderPNG, strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, body, string(result.Data))
	}
}

func TestRenderCancelledBody(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	body := &trackedBody{Reader: readerFunc(func([]byte) (int, error) { cancel(); return 0, context.Canceled })}
	keys := &testKeys{}
	s, err := NewService(Config{
		Renderer: ImageRendererConfig{URL: "https://renderer", AuthToken: "renderer-secret"},
		Settings: func(context.Context) (Settings, error) {
			return Settings{CallbackURL: "https://grafana"}, nil
		},
		Keys: keys, Store: MemoryStore{MaxBytes: 1024},
		Client: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) { return &http.Response{StatusCode: 200, Body: body}, nil })},
	})
	require.NoError(t, err)
	_, err = s.Render(ctx, RenderPNG, Opts{CommonOpts: CommonOpts{TimeoutOpts: TimeoutOpts{Timeout: time.Second}}})
	require.True(t, errors.Is(err, context.Canceled))
	require.True(t, body.closed)
	require.EqualValues(t, 1, keys.released.Load())
	require.Empty(t, s.limiter.(*LocalConcurrencyLimiter).inProgress)
}

type readerFunc func([]byte) (int, error)

func (f readerFunc) Read(b []byte) (int, error) { return f(b) }
