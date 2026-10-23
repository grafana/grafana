package rendering

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
)

func TestAvailabilityStrategies(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		probe := NewRemoteAvailability(ProbeConfig{
			Renderer: ImageRendererConfig{URL: "https://renderer", AuthToken: "health-secret"},
			Interval: time.Second,
			Client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				require.Equal(t, "/version", r.URL.Path)
				require.Equal(t, "health-secret", r.Header.Get(authTokenHeader))

				if calls.Add(1) == 2 {
					return &http.Response{StatusCode: 503, Body: io.NopCloser(strings.NewReader(""))}, nil
				}

				return rendererResponse(`{"version":"4.0.0"}`), nil
			})},
		})
		configured := ConfiguredAvailability{Monitor: probe}

		require.True(t, configured.IsAvailable(t.Context()))
		require.False(t, probe.IsAvailable(t.Context()))

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() { done <- probe.Run(ctx) }()
		synctest.Wait()

		require.True(t, probe.IsAvailable(ctx))
		require.Equal(t, "4.0.0", configured.Version())

		time.Sleep(time.Second)
		synctest.Wait()
		require.False(t, probe.IsAvailable(ctx))
		require.True(t, configured.IsAvailable(ctx), "ST availability must remain configuration-based")

		time.Sleep(time.Second)
		synctest.Wait()
		require.True(t, probe.IsAvailable(ctx))

		cancel()
		require.NoError(t, <-done)
		time.Sleep(2 * time.Second)
		require.EqualValues(t, 3, calls.Load())
	})
}

func TestRemoteAvailabilityCancellation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		probe := NewRemoteAvailability(ProbeConfig{
			Renderer: ImageRendererConfig{URL: "https://renderer"},
			Timeout:  time.Second,
			Client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				calls.Add(1)
				<-r.Context().Done()
				return nil, r.Context().Err()
			})},
		})

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() { done <- probe.Run(ctx) }()
		synctest.Wait()

		time.Sleep(time.Second)
		synctest.Wait()
		require.ErrorIs(t, probe.Health(), ErrServerTimeout)

		time.Sleep(15 * time.Second)
		synctest.Wait()
		require.EqualValues(t, 2, calls.Load())

		cancel()
		require.NoError(t, <-done)
		require.ErrorIs(t, probe.Health(), context.Canceled)
	})
}

func TestPDFDoesNotProbeCapabilities(t *testing.T) {
	s, err := NewService(Config{
		Renderer: ImageRendererConfig{URL: "https://renderer/render", AuthToken: "renderer-secret"},
		Settings: func(context.Context) (Settings, error) {
			return Settings{CallbackURL: "https://grafana"}, nil
		},
		Keys: &testKeys{}, Store: MemoryStore{MaxBytes: 1024},
		Client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			require.Equal(t, "/render", r.URL.Path, "PDF rendering must not depend on version probes")
			return rendererResponse("pdf"), nil
		})},
	})
	require.NoError(t, err)

	result, err := s.Render(t.Context(), RenderPDF, Opts{CommonOpts: CommonOpts{TimeoutOpts: TimeoutOpts{Timeout: time.Second}}})
	require.NoError(t, err)
	require.Equal(t, "pdf", string(result.Data))
}

func TestVersionProbeCompatibility(t *testing.T) {
	for _, tc := range []struct {
		name          string
		status        int
		body, version string
		wantErr       bool
	}{
		{"current", 200, `{"version":"4.0.0"}`, "4.0.0", false},
		{"legacy", 404, "", "1.0.0", false},
		{"server error", 500, "", "", true},
		{"invalid JSON", 200, "invalid", "", true},
		{"empty version", 200, `{}`, "", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := &trackedBody{Reader: strings.NewReader(tc.body)}
			probe := NewRemoteAvailability(ProbeConfig{
				Renderer: ImageRendererConfig{URL: "https://renderer/render"}, UserAgent: StaticUserAgent("Grafana/12.4.0"),
				Client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
					require.Equal(t, "/render/version", r.URL.Path)
					require.Equal(t, "Grafana/12.4.0", r.Header.Get("User-Agent"))
					return &http.Response{StatusCode: tc.status, Body: body}, nil
				})},
			})
			version, err := probe.probe(t.Context())
			require.Equal(t, tc.version, version)
			if tc.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			require.True(t, body.closed)
		})
	}
}
