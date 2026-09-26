package router

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"golang.org/x/net/http/httpguts"

	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/endpoints/request"
)

var requestInfoFactory = &request.RequestInfoFactory{
	APIPrefixes:          sets.NewString(strings.TrimPrefix(apisPrefix, "/")),
	GrouplessAPIPrefixes: sets.NewString(),
}

// requestVerb returns the Kubernetes verb for req: "watch" for a watch, "list"
// or "get" for reads, and so on. Paths outside the resource API, such as
// discovery and OpenAPI, return the lowercased HTTP method.
func requestVerb(req *http.Request) string {
	info, err := requestInfoFactory.NewRequestInfo(req)
	if err != nil || info.Verb == "" {
		return strings.ToLower(req.Method)
	}
	return info.Verb
}

// rejectUpgrade answers an upgrade request, which is how a client asks for a
// watch over WebSocket. The router does not proxy upgrades, so it says so
// rather than failing some other way.
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
