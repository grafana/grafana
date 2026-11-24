package liveserver

import (
	"errors"
	"testing"

	"github.com/centrifugal/centrifuge"
	"github.com/stretchr/testify/require"
)

func TestChannelScope(t *testing.T) {
	for channel, want := range map[string]string{
		"stacks-1/grafana/dashboard/uid/abc": "grafana",
		"stacks-1/stream/my-stream/cpu":      "stream",
		"stacks-1/ds/uid/path":               "ds",
		"stacks-1/plugin/p/path":             "plugin",
		"stacks-1/watch/x":                   "watch",
		"stacks-1/made-up/x":                 ScopeUnknown,
		"no-slash":                           ScopeUnknown,
		"":                                   ScopeUnknown,
	} {
		require.Equal(t, want, ChannelScope(channel), channel)
	}
}

func TestSubscribeResult(t *testing.T) {
	require.Equal(t, ResultOK, SubscribeResult(nil))
	require.Equal(t, "permission_denied", SubscribeResult(centrifuge.ErrorPermissionDenied))
	require.Equal(t, "permission_denied", SubscribeResult(&centrifuge.Error{Code: 403}))
	require.Equal(t, "not_found", SubscribeResult(&centrifuge.Error{Code: 404}))
	require.Equal(t, "not_found", SubscribeResult(centrifuge.ErrorUnknownChannel))
	require.Equal(t, "bad_request", SubscribeResult(&centrifuge.Error{Code: 400}))
	require.Equal(t, "not_available", SubscribeResult(centrifuge.ErrorNotAvailable))
	require.Equal(t, "expired", SubscribeResult(errorExpiredTemporary))
	require.Equal(t, "internal", SubscribeResult(centrifuge.ErrorInternal))
	require.Equal(t, "internal", SubscribeResult(errors.New("boom")))
	require.Equal(t, "other", SubscribeResult(&centrifuge.Error{Code: 9999}))
}

func TestDisconnectReason(t *testing.T) {
	require.Equal(t, "client_closed", DisconnectReason(centrifuge.DisconnectConnectionClosed.Code))
	require.Equal(t, "shutdown", DisconnectReason(centrifuge.DisconnectShutdown.Code))
	require.Equal(t, "expired", DisconnectReason(centrifuge.DisconnectExpired.Code))
	require.Equal(t, "connection_limit", DisconnectReason(centrifuge.DisconnectConnectionLimit.Code))
	require.Equal(t, "other", DisconnectReason(12345))
}

type recordingObserver struct {
	subscribed   [][2]string
	disconnected []string
}

func (r *recordingObserver) Subscribed(scope, result string) {
	r.subscribed = append(r.subscribed, [2]string{scope, result})
}
func (r *recordingObserver) Disconnected(reason string) {
	r.disconnected = append(r.disconnected, reason)
}

func TestDispatcherObserver(t *testing.T) {
	obs := &recordingObserver{}
	d, _ := newTestDispatcher(t, Options{Observer: obs})

	d.observeSubscribe("stacks-1/grafana/dashboard/uid/abc", nil)
	d.observeSubscribe("stacks-1/ds/uid/x", centrifuge.ErrorNotAvailable)
	d.observeDisconnect(centrifuge.DisconnectShutdown.Code)
	require.Equal(t, [][2]string{{"grafana", "ok"}, {"ds", "not_available"}}, obs.subscribed)
	require.Equal(t, []string{"shutdown"}, obs.disconnected)

	// No observer is fine.
	d2, _ := newTestDispatcher(t, Options{})
	d2.observeSubscribe("x", nil)
	d2.observeDisconnect(0)
}
