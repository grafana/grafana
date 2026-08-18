package nats

import (
	"context"
	"fmt"
	"testing"

	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestPublisher(t *testing.T) {
	t.Run("is disabled when NATS is off", func(t *testing.T) {
		cfg := setting.NATSSettings{Enabled: false}
		p := newPublisher(log.NewNopLogger(), newPublisherMetrics(), newConfig(cfg, nil))

		require.False(t, p.Enabled())
		require.True(t, p.IsDisabled())
		require.ErrorIs(t, p.Publish(context.Background(), "subj", []byte("x")), ErrDisabled)
	})

	t.Run("publishes a message", func(t *testing.T) {
		p := newTestPublisher(t, startTestServer(t))
		require.NoError(t, p.Publish(context.Background(), "grafana.test.a", []byte("hello")))
	})

	t.Run("publish after close returns ErrClosed", func(t *testing.T) {
		p := newTestPublisher(t, startTestServer(t))
		require.NoError(t, p.Publish(context.Background(), "grafana.test.a", []byte("hello")))

		p.close()
		require.ErrorIs(t, p.Publish(context.Background(), "grafana.test.a", []byte("world")), ErrClosed)
	})

	t.Run("publish reports a connection that was never established", func(t *testing.T) {
		cfg := setting.NATSSettings{
			Enabled:    true,
			Mode:       setting.NATSModeExternal,
			ClientURLs: []string{"nats://127.0.0.1:1"},
		}
		p := newPublisher(log.NewNopLogger(), newPublisherMetrics(), newConfig(cfg, nil))
		t.Cleanup(p.close)

		err := p.Publish(context.Background(), "grafana.test.a", []byte("hello"))
		require.ErrorIs(t, err, natsclient.ErrReconnectBufExceeded)
		require.ErrorContains(t, err, "connection not established")
	})

	t.Run("isConnStateErr", func(t *testing.T) {
		for _, tc := range []struct {
			name string
			err  error
			want bool
		}{
			{"reconnect buffer exceeded", natsclient.ErrReconnectBufExceeded, true},
			{"connection closed", natsclient.ErrConnectionClosed, true},
			{"connection draining", natsclient.ErrConnectionDraining, true},
			{"wrapped", fmt.Errorf("publish: %w", natsclient.ErrConnectionClosed), true},
			{"max payload", natsclient.ErrMaxPayload, false},
			{"bad subject", natsclient.ErrBadSubject, false},
			{"nil", nil, false},
		} {
			t.Run(tc.name, func(t *testing.T) {
				require.Equal(t, tc.want, isConnStateErr(tc.err))
			})
		}
	})

	t.Run("publish honours a cancelled context", func(t *testing.T) {
		p := newTestPublisher(t, startTestServer(t))

		// Warm the connection so get() succeeds and the cancellation is observed by
		// the explicit ctx.Err() check rather than during connect.
		require.NoError(t, p.Publish(context.Background(), "grafana.test.a", []byte("hello")))

		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		require.ErrorIs(t, p.Publish(ctx, "grafana.test.a", []byte("world")), context.Canceled)
	})
}

func TestPublisherAsyncErrors(t *testing.T) {
	// The exact text nats-server sends for a rejected publish, as nats.go wraps it
	// (see processErr -> processTransientError). Publish has already returned nil
	// by the time this arrives, and the *Subscription is nil, so the subject is
	// only available from the message itself.
	permissionsViolation := func(subject string) error {
		return fmt.Errorf("%w: Permissions Violation for Publish to %q", natsclient.ErrPermissionViolation, subject)
	}

	tests := []struct {
		name         string
		err          error
		wantGroup    string
		wantResource string
		wantReason   string
	}{
		{
			name:         "rejected publish is attributed to its group and resource",
			err:          permissionsViolation("us.watch.v1.provisioning.grafana.app.stacks-1.jobs"),
			wantGroup:    "provisioning.grafana.app",
			wantResource: "jobs",
			wantReason:   reasonPermissionsViolation,
		},
		{
			name:       "rejected publish on a subject this bus does not own",
			err:        permissionsViolation("some.other.subject"),
			wantReason: reasonPermissionsViolation,
		},
		{
			name:       "authorization violation carries no subject",
			err:        natsclient.ErrAuthorization,
			wantReason: reasonAuthorization,
		},
		{
			name:       "expired credentials",
			err:        natsclient.ErrAuthExpired,
			wantReason: reasonAuthExpired,
		},
		{
			name:       "unclassified errors are not dropped",
			err:        context.Canceled,
			wantReason: reasonOther,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			m := newPublisherMetrics()
			cfg := setting.NATSSettings{Enabled: true}
			p := newPublisher(log.NewNopLogger(), m, newConfig(cfg, nil))

			// Drive the connection's async error hook directly, as the NATS client
			// would from its own goroutine.
			p.onAsyncError(tc.err)

			require.Equal(t, float64(1), testutil.ToFloat64(m.asyncErrors.WithLabelValues(tc.wantGroup, tc.wantResource, tc.wantReason)))
			require.Equal(t, 1, testutil.CollectAndCount(m.asyncErrors), "exactly one series must be touched")
		})
	}

	t.Run("a nil error is ignored", func(t *testing.T) {
		m := newPublisherMetrics()
		m.recordAsyncError(nil)
		require.Equal(t, 0, testutil.CollectAndCount(m.asyncErrors))
	})
}
