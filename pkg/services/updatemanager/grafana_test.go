package updatemanager

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/require"
)

func TestGrafanaService(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("when the Grafana version is stable", func(t *testing.T) {
		t.Parallel()

		t.Run("and the latest version is newer than the current one", func(t *testing.T) {
			t.Parallel()

			grafanaVersion := "99.0.0"
			latestVersion := "99.0.1"

			httpClient := &fakeHTTPClient{
				fakeResp: `{"version": "` + latestVersion + `"}`,
			}

			service := &GrafanaService{
				enabled:        true,
				grafanaVersion: grafanaVersion,
				httpClient:     httpClient,
				log:            log.NewNopLogger(),
				tracer:         tracing.NewNoopTracerService(),
			}

			err := service.checkForUpdates(ctx)
			require.NoError(t, err)

			require.True(t, service.UpdateAvailable())
			require.Equal(t, latestVersion, service.LatestVersion())
			require.False(t, service.IsDisabled())
		})

		t.Run("and the latest version is the same as the current one", func(t *testing.T) {
			t.Parallel()

			grafanaVersion := "99.0.0"
			latestVersion := grafanaVersion

			httpClient := &fakeHTTPClient{
				fakeResp: `{"version": "` + latestVersion + `"}`,
			}

			service := &GrafanaService{
				enabled:        true,
				grafanaVersion: grafanaVersion,
				httpClient:     httpClient,
				log:            log.NewNopLogger(),
				tracer:         tracing.NewNoopTracerService(),
			}

			err := service.checkForUpdates(ctx)
			require.NoError(t, err)

			require.False(t, service.UpdateAvailable())
			require.Equal(t, grafanaVersion, service.LatestVersion())
			require.False(t, service.IsDisabled())
		})
	})

	t.Run("when the Grafana version is a development build", func(t *testing.T) {
		t.Parallel()

		grafanaVersion := "99.0.0-222555"
		lastestVersion := "99.0.1"

		httpClient := &fakeHTTPClient{
			fakeResp: `{"version": "` + lastestVersion + `"}`,
		}

		service := &GrafanaService{
			enabled:        true,
			grafanaVersion: grafanaVersion,
			httpClient:     httpClient,
			log:            log.NewNopLogger(),
			tracer:         tracing.NewNoopTracerService(),
		}

		err := service.checkForUpdates(ctx)
		require.NoError(t, err)

		require.False(t, service.UpdateAvailable())
		require.Empty(t, service.LatestVersion())
		require.False(t, service.IsDisabled())
	})
}

func TestGrafanaService_Run(t *testing.T) {
	latestVersion := "99.0.1"

	service := &GrafanaService{
		enabled:        true,
		grafanaVersion: "99.0.0",
		httpClient: &fakeHTTPClient{
			fakeResp: `{"version": "` + latestVersion + `"}`,
		},
		log:    log.NewNopLogger(),
		tracer: tracing.NewNoopTracerService(),
	}

	ctx, cancel := context.WithCancel(context.Background())

	// Initially there won't be any data.
	require.False(t, service.UpdateAvailable())
	require.Empty(t, service.LatestVersion())

	// Run in the background so we can cancel it after the first run.
	errChan := make(chan error, 1)
	go func() {
		errChan <- service.Run(ctx)
	}()

	// It will run once immediately then schedule it for 24 hours later. This will be true because latest > current.
	require.Eventually(t, func() bool { return service.UpdateAvailable() }, 5*time.Second, 20*time.Millisecond)

	cancel()

	require.ErrorIs(t, <-errChan, context.Canceled)
}
