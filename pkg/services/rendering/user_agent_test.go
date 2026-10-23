package rendering

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type userAgentFunc func(context.Context) (string, error)

func (f userAgentFunc) UserAgent(ctx context.Context) (string, error) { return f(ctx) }

func TestRendererUserAgent(t *testing.T) {
	wantErr := errors.New("user agent unavailable")
	for _, providerErr := range []error{nil, wantErr} {
		name := "injected value overrides caller header"
		if providerErr != nil {
			name = "provider failure prevents request"
		}

		t.Run(name, func(t *testing.T) {
			calls := 0
			service, err := NewService(Config{
				Renderer: ImageRendererConfig{URL: "https://renderer/render", AuthToken: "service-secret"},
				UserAgent: userAgentFunc(func(ctx context.Context) (string, error) {
					require.NoError(t, ctx.Err())
					return "CustomRenderer", providerErr
				}),
				Settings: func(context.Context) (Settings, error) { return Settings{CallbackURL: "https://grafana"}, nil },
				Keys:     &testKeys{}, Store: MemoryStore{MaxBytes: 1024},
				Client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
					calls++
					require.Equal(t, "CustomRenderer", r.Header.Get("User-Agent"))
					require.Equal(t, "service-secret", r.Header.Get("X-Auth-Token"))
					return rendererResponse("ok"), nil
				})},
			})
			require.NoError(t, err)

			_, err = service.Render(t.Context(), RenderPNG, Opts{CommonOpts: CommonOpts{
				TimeoutOpts: TimeoutOpts{Timeout: time.Second}, Headers: http.Header{"User-Agent": {"spoofed"}},
			}})
			if providerErr != nil {
				require.ErrorIs(t, err, providerErr)
				require.Zero(t, calls)
			} else {
				require.NoError(t, err)
				require.Equal(t, 1, calls)
			}
		})
	}
}
