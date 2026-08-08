package nats

import (
	"context"
	"testing"
	"time"

	natsclient "github.com/nats-io/nats.go"
	"github.com/stretchr/testify/require"
)

func TestWakeDebug(t *testing.T) {
	ctx := context.Background()
	reg := newFakeRegistry()
	self := peer{ServerName: "self", RouteURL: "nats://10.0.0.1:6222"}
	require.NoError(t, reg.upsert(ctx, self))

	d := newTestDiscovery(t, reg, self)
	require.NotNil(t, d.wakeConn, "wakeConn should be connected")
	t.Logf("wakeConn connected=%v status=%v", d.wakeConn.IsConnected(), d.wakeConn.Status())

	received := make(chan struct{}, 1)
	sub, err := d.wakeConn.Subscribe(discoveryWakeSubject, func(m *natsclient.Msg) {
		received <- struct{}{}
	})
	require.NoError(t, err)
	defer sub.Unsubscribe()

	d.broadcastWake()

	select {
	case <-received:
		t.Log("received own broadcast (echo not disabled on this sub?)")
	case <-time.After(500 * time.Millisecond):
		t.Log("did not receive own broadcast (expected: NoEcho)")
	}

	// now test via the discovery's own registered handler using requestWake side effect
	d.wake = make(chan struct{}, 1)
	d.broadcastWake()
	select {
	case <-d.wake:
		t.Log("wake channel got signaled")
	case <-time.After(500 * time.Millisecond):
		t.Log("wake channel NOT signaled")
	}
}
