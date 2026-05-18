package resource

import (
	"context"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestNATSNotifierPublishesAndWatchesEvents(t *testing.T) {
	srv, nc := startTestNATSServer(t)
	defer srv.Shutdown()
	defer nc.Close()

	provider := &testNATSClientProvider{conn: nc}
	notifier := newNATSNotifier(provider, log.NewNopLogger())

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	events := notifier.Watch(ctx, WatchOptions{BufferSize: 1})
	expected := Event{
		Namespace:       "default",
		Group:           "dashboard.grafana.app",
		Resource:        "dashboards",
		Name:            "dash-1",
		ResourceVersion: 123,
		Action:          DataActionCreated,
	}

	require.Eventually(t, func() bool {
		return nc.NumSubscriptions() == 1
	}, time.Second, 10*time.Millisecond)

	notifier.Publish(expected)

	select {
	case got := <-events:
		require.Equal(t, expected, got)
	case <-ctx.Done():
		require.FailNow(t, "timed out waiting for nats event")
	}
}

type testNATSClientProvider struct {
	conn *natsclient.Conn
}

func (p *testNATSClientProvider) Enabled() bool {
	return true
}

func (p *testNATSClientProvider) Connect(context.Context, string, ...natsclient.Option) (*natsclient.Conn, error) {
	return p.conn, nil
}

func (p *testNATSClientProvider) Publisher(context.Context) (*natsclient.Conn, error) {
	return p.conn, nil
}

func (p *testNATSClientProvider) Subscriber(context.Context) (*natsclient.Conn, error) {
	return p.conn, nil
}

func startTestNATSServer(t *testing.T) (*natsserver.Server, *natsclient.Conn) {
	t.Helper()

	srv, err := natsserver.NewServer(&natsserver.Options{
		Host:      "127.0.0.1",
		Port:      natsserver.RANDOM_PORT,
		NoLog:     true,
		NoSigs:    true,
		JetStream: false,
	})
	require.NoError(t, err)
	srv.Start()
	require.True(t, srv.ReadyForConnections(5*time.Second))

	nc, err := natsclient.Connect(srv.ClientURL())
	require.NoError(t, err)
	return srv, nc
}
