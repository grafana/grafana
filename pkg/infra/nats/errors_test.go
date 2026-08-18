package nats

import (
	"context"
	"fmt"
	"testing"

	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func TestIsConnStateErr(t *testing.T) {
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
}

func TestRecordAsyncError(t *testing.T) {
	// The exact text nats-server sends for a rejected publish, as nats.go wraps it
	// (see processErr -> processTransientError). Publish has already returned nil
	// by the time this arrives, and the *Subscription is nil, so the subject is
	// only available from the message itself.
	publishViolation := func(subject string) error {
		return fmt.Errorf("%w: Permissions Violation for Publish to %q", natsclient.ErrPermissionViolation, subject)
	}

	tests := []struct {
		name         string
		sub          *natsclient.Subscription
		err          error
		wantGroup    string
		wantResource string
		wantReason   string
	}{
		{
			name:         "rejected publish is attributed to its group and resource",
			err:          publishViolation("us.watch.v1.provisioning.grafana.app.stacks-1.jobs"),
			wantGroup:    "provisioning.grafana.app",
			wantResource: "jobs",
			wantReason:   reasonPermissionsViolation,
		},
		{
			name:       "rejected publish on a subject this bus does not own",
			err:        publishViolation("some.other.subject"),
			wantReason: reasonPermissionsViolation,
		},
		{
			name:         "rejected subscribe is attributed from the subscription",
			sub:          &natsclient.Subscription{Subject: "us.watch.v1.dashboard.grafana.app.stacks-1.dashboards"},
			err:          natsclient.ErrPermissionViolation,
			wantGroup:    "dashboard.grafana.app",
			wantResource: "dashboards",
			wantReason:   reasonPermissionsViolation,
		},
		{
			name:         "slow consumer keeps the subscription's attribution",
			sub:          &natsclient.Subscription{Subject: "us.watch.v1.provisioning.grafana.app.stacks-1.jobs"},
			err:          natsclient.ErrSlowConsumer,
			wantGroup:    "provisioning.grafana.app",
			wantResource: "jobs",
			wantReason:   reasonSlowConsumer,
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
			for _, role := range []connRole{rolePublisher, roleSubscriber} {
				t.Run(string(role), func(t *testing.T) {
					m := newConnectionMetrics(role)
					m.recordAsyncError(tc.sub, tc.err)

					require.Equal(t, float64(1), testutil.ToFloat64(m.asyncErrors.WithLabelValues(tc.wantGroup, tc.wantResource, tc.wantReason)))
					require.Equal(t, 1, testutil.CollectAndCount(m.asyncErrors), "exactly one series must be touched")
				})
			}
		})
	}

	t.Run("a nil error is ignored", func(t *testing.T) {
		m := newConnectionMetrics(rolePublisher)
		m.recordAsyncError(nil, nil)
		require.Equal(t, 0, testutil.CollectAndCount(m.asyncErrors))
	})
}
