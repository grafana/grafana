package router

import (
	"context"
	"errors"
	"net/http"

	"golang.org/x/net/http/httpguts"
)

// rejectUpgrade answers an upgrade request, which is how a client asks for a
// watch over WebSocket. The router does not proxy upgrades, so it says so
// rather than failing some other way. An HTTP/2 extended CONNECT (RFC 8441)
// carries no Connection header and is not caught here.
func rejectUpgrade(w http.ResponseWriter, req *http.Request) bool {
	if !httpguts.HeaderValuesContainsToken(req.Header["Connection"], "Upgrade") {
		return false
	}
	http.Error(w, "the router does not support protocol upgrades; watch over WebSocket is not supported, use a streaming watch", http.StatusBadRequest)
	return true
}

// serveWatch runs a watch whose lifetime the router controls: it ends when
// scope ends (its group's backend was replaced or removed) or when the router
// closes its watches on shutdown. Clients then re-establish the watch, as they
// do when an apiserver ends one. Ordinary requests are not affected.
func (r *GrafanaRouter) serveWatch(w http.ResponseWriter, req *http.Request, scope context.Context, serve func(http.ResponseWriter, *http.Request)) {
	ctx, cancel := context.WithCancel(req.Context())
	defer cancel()
	if scope != nil {
		stopScope := context.AfterFunc(scope, cancel)
		defer stopScope()
	}
	if r.watches != nil {
		stopRouter := context.AfterFunc(r.watches, cancel)
		defer stopRouter()
	}

	defer func() {
		p := recover()
		if p == nil {
			return
		}
		// ReverseProxy aborts the response when copying the body fails. When the
		// router ended the watch itself, finish the response normally instead,
		// so the client sees the stream end cleanly.
		if err, ok := p.(error); ok && errors.Is(err, http.ErrAbortHandler) && ctx.Err() != nil && req.Context().Err() == nil {
			return
		}
		panic(p)
	}()
	serve(w, req.WithContext(ctx))
}

// closeWatches ends every watch the router is serving. A watch never goes
// idle, so without this a server shutdown would wait for each one to end.
func (r *GrafanaRouter) closeWatches() {
	if r.endWatches != nil {
		r.endWatches()
	}
}
