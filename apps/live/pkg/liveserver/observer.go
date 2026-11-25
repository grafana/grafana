package liveserver

import (
	"errors"
	"net/http"
	"strings"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/live"

	"github.com/grafana/grafana/apps/live/pkg/orgchannel"
)

// Observer receives what happens on a Dispatcher so a host can export metrics.
// Methods are called on the connection goroutines and must not block. Every
// string passed in comes from a small fixed set, so it is safe as a metric
// label.
type Observer interface {
	// Subscribed is called once for every subscribe attempt. scope is a Live
	// scope or ScopeUnknown, and result is ResultOK or a SubscribeError reason.
	Subscribed(scope string, result string)
	// Disconnected is called when a client goes away, with a DisconnectReason.
	Disconnected(reason string)
}

const (
	// ScopeUnknown stands for a channel that has no valid scope.
	ScopeUnknown = "unknown"
	// ResultOK is the result of a subscribe that succeeded.
	ResultOK = "ok"
)

// ChannelScope returns the Live scope of a channel with a k8s namespace, or
// ScopeUnknown when it has none that exists.
func ChannelScope(channel string) string {
	_, rest, err := orgchannel.StripK8sNamespace(channel)
	if err != nil {
		return ScopeUnknown
	}
	scope, _, _ := strings.Cut(rest, "/")
	switch scope {
	case live.ScopeGrafana, live.ScopeWatch, live.ScopePlugin, live.ScopeDatasource, live.ScopeStream:
		return scope
	}
	return ScopeUnknown
}

// SubscribeResult names the outcome of a subscribe, given the error the
// dispatcher answered with.
func SubscribeResult(err error) string {
	if err == nil {
		return ResultOK
	}
	var ce *centrifuge.Error
	if !errors.As(err, &ce) {
		return "internal"
	}
	switch ce.Code {
	case centrifuge.ErrorPermissionDenied.Code, http.StatusForbidden:
		return "permission_denied"
	case centrifuge.ErrorUnknownChannel.Code, http.StatusNotFound:
		return "not_found"
	case centrifuge.ErrorBadRequest.Code, http.StatusBadRequest:
		return "bad_request"
	case centrifuge.ErrorNotAvailable.Code:
		return "not_available"
	case centrifuge.ErrorExpired.Code:
		return "expired"
	case centrifuge.ErrorTooManyRequests.Code, http.StatusTooManyRequests:
		return "too_many_requests"
	case centrifuge.ErrorInternal.Code, http.StatusInternalServerError:
		return "internal"
	}
	return "other"
}

// DisconnectReason names why a client disconnected, from its Centrifuge code.
func DisconnectReason(code uint32) string {
	switch code {
	case centrifuge.DisconnectConnectionClosed.Code:
		return "client_closed"
	case centrifuge.DisconnectShutdown.Code:
		return "shutdown"
	case centrifuge.DisconnectServerError.Code:
		return "server_error"
	case centrifuge.DisconnectExpired.Code, centrifuge.DisconnectSubExpired.Code:
		return "expired"
	case centrifuge.DisconnectSlow.Code:
		return "slow"
	case centrifuge.DisconnectWriteError.Code:
		return "write_error"
	case centrifuge.DisconnectNoPong.Code:
		return "no_pong"
	case centrifuge.DisconnectForceReconnect.Code, centrifuge.DisconnectForceNoReconnect.Code:
		return "forced"
	case centrifuge.DisconnectConnectionLimit.Code:
		return "connection_limit"
	case centrifuge.DisconnectChannelLimit.Code:
		return "channel_limit"
	case centrifuge.DisconnectPermissionDenied.Code:
		return "permission_denied"
	case centrifuge.DisconnectTooManyRequests.Code, centrifuge.DisconnectTooManyErrors.Code:
		return "too_many_requests"
	case centrifuge.DisconnectInvalidToken.Code, centrifuge.DisconnectBadRequest.Code:
		return "bad_request"
	}
	return "other"
}

func (d *Dispatcher) observeSubscribe(channel string, err error) {
	if d.opts.Observer != nil {
		d.opts.Observer.Subscribed(ChannelScope(channel), SubscribeResult(err))
	}
}

func (d *Dispatcher) observeDisconnect(code uint32) {
	if d.opts.Observer != nil {
		d.opts.Observer.Disconnected(DisconnectReason(code))
	}
}
