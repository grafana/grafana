package rendering

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestSharedConcurrencyLimiter(t *testing.T) {
	entered := make(chan struct{})
	limiter := NewLocalConcurrencyLimiter()
	cfg := Config{
		Renderer: ImageRendererConfig{URL: "https://renderer/render"},
		Settings: func(context.Context) (Settings, error) {
			return Settings{CallbackURL: "https://grafana", TenantID: "stacks-1", ConcurrentLimit: 1}, nil
		},
		Limiter: limiter, Keys: &testKeys{}, Store: MemoryStore{MaxBytes: 1024},
		Client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.Query().Get("url") == "https://grafana/block?render=1" {
				close(entered)
				<-r.Context().Done()
				return nil, r.Context().Err()
			}
			return rendererResponse("ok"), nil
		})},
	}
	first, err := NewService(cfg)
	require.NoError(t, err)
	second, err := NewService(cfg)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	opts := Opts{
		CommonOpts: CommonOpts{AuthOpts: AuthOpts{OrgID: 1}, TimeoutOpts: TimeoutOpts{Timeout: time.Minute}, Path: "block"},
		ErrorOpts:  ErrorOpts{ErrorConcurrentLimitReached: true},
	}
	done := make(chan error, 1)
	go func() { _, err := first.Render(ctx, RenderPNG, opts); done <- err }()
	<-entered

	opts.Path = "d/test"
	_, err = second.Render(t.Context(), RenderPDF, opts)
	require.ErrorIs(t, err, ErrConcurrentLimitReached, "separate services must use the injected budget")

	opts.OrgID = 2
	_, err = second.Render(t.Context(), RenderPDF, opts)
	require.NoError(t, err, "other organizations must remain independent")

	cancel()
	require.ErrorIs(t, <-done, context.Canceled)
	opts.OrgID = 1
	_, err = second.Render(t.Context(), RenderPDF, opts)
	require.NoError(t, err, "cancellation must return the shared slot")
	require.Empty(t, limiter.inProgress)
}
