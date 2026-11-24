// Package liveserver holds the parts of a Grafana Live server that do not
// depend on where it runs: the Centrifuge Redis engine setup, the websocket
// Origin check, and the dispatcher that authorizes client events and routes
// each channel to the handler for its scope. Single-tenant Grafana and a
// multi-tenant Live server both build on it, each supplying its own scopes.
package liveserver

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/centrifugal/centrifuge"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/apps/live/pkg/managedstream"
	"github.com/grafana/grafana/apps/live/pkg/model"
	"github.com/grafana/grafana/apps/live/pkg/orgchannel"
	"github.com/grafana/grafana/apps/live/pkg/pipeline"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
)

var (
	logger = log.New("live")
	// The tracer keeps the name it had in pkg/services/live so existing traces
	// and dashboards keep matching.
	tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/live")
)

// ErrScopeNotAvailable is returned for a valid scope this server does not serve.
var ErrScopeNotAvailable = errors.New("scope not available")

// ScopeHandler returns the handler factory for a namespace within one scope,
// for example the plugin ID in plugin/{plugin}/{path}.
type ScopeHandler interface {
	GetHandlerFactory(ctx context.Context, user identity.Requester, namespace string) (model.ChannelHandlerFactory, error)
}

// ScopeHandlerFunc adapts a function to ScopeHandler.
type ScopeHandlerFunc func(ctx context.Context, user identity.Requester, namespace string) (model.ChannelHandlerFactory, error)

func (f ScopeHandlerFunc) GetHandlerFactory(ctx context.Context, user identity.Requester, namespace string) (model.ChannelHandlerFactory, error) {
	return f(ctx, user, namespace)
}

// Features serves a scope from a fixed set of named features, such as
// grafana/dashboard.
type Features map[string]model.ChannelHandlerFactory

func (f Features) GetHandlerFactory(_ context.Context, _ identity.Requester, namespace string) (model.ChannelHandlerFactory, error) {
	if p, ok := f[namespace]; ok {
		return p, nil
	}
	return nil, fmt.Errorf("unknown feature: %q", namespace)
}

// Single serves every namespace of a scope with one handler factory.
func Single(factory model.ChannelHandlerFactory) ScopeHandler {
	return ScopeHandlerFunc(func(context.Context, identity.Requester, string) (model.ChannelHandlerFactory, error) {
		return factory, nil
	})
}

// StreamScope serves the stream scope from the managed streams of the
// requester's namespace.
func StreamScope(runner *managedstream.Runner) ScopeHandler {
	return ScopeHandlerFunc(func(_ context.Context, user identity.Requester, namespace string) (model.ChannelHandlerFactory, error) {
		return runner.GetOrCreateStream(user.GetNamespace(), live.ScopeStream, namespace)
	})
}

// Pipeline is the optional channel rule pipeline. Channels with a rule are
// handled by the pipeline instead of their scope.
type Pipeline interface {
	Get(ns string, channel string) (*pipeline.LiveChannelRule, bool, error)
	ProcessInput(ctx context.Context, ns string, channelID string, body []byte) (bool, error)
}

// Options configures a Dispatcher.
type Options struct {
	// Scopes maps a channel scope (live.ScopeGrafana, ...) to its handler.
	// A valid scope without a handler is answered as not available.
	Scopes map[string]ScopeHandler
	// Pipeline is optional.
	Pipeline Pipeline
	// MaxConnections is the most clients the node accepts; negative means no
	// limit.
	MaxConnections int
	// Observer is optional and receives subscribe and disconnect events.
	Observer Observer
}

// Dispatcher handles the events of the clients connected to a Centrifuge node.
// Every subscribe and publish must be for a channel in the requester's own
// namespace.
type Dispatcher struct {
	node *centrifuge.Node
	opts Options

	channels   map[string]model.ChannelHandler
	channelsMu sync.RWMutex
}

// NewDispatcher returns a dispatcher for node. Call Attach before node.Run.
func NewDispatcher(node *centrifuge.Node, opts Options) *Dispatcher {
	return &Dispatcher{
		node:     node,
		opts:     opts,
		channels: make(map[string]model.ChannelHandler),
	}
}

// Attach registers the dispatcher as node's connect handler.
func (d *Dispatcher) Attach() {
	d.node.OnConnect(d.onConnect)
}

var clientConcurrency = 12

// errorExpiredTemporary mirrors centrifuge.ErrorExpired but sets Temporary so
// clients retry the operation with backoff after a server-side token refresh,
// instead of treating the error as fatal and tearing down the subscription.
var errorExpiredTemporary = &centrifuge.Error{
	Code:      centrifuge.ErrorExpired.Code,
	Message:   centrifuge.ErrorExpired.Message,
	Temporary: true,
}

// onConnect is called concurrently from the goroutines of different client
// connections, so everything it touches must be synchronized.
func (d *Dispatcher) onConnect(client *centrifuge.Client) {
	_, connectSpan := tracer.Start(client.Context(), "live.OnConnect")
	defer connectSpan.End()
	connectSpan.SetAttributes(
		attribute.String("user", client.UserID()),
		attribute.String("client", client.ID()),
	)

	numConnections := d.node.Hub().NumClients()
	if d.opts.MaxConnections >= 0 && numConnections > d.opts.MaxConnections {
		logger.Warn(
			"Max number of Live connections reached, increase max_connections in [live] configuration section",
			"user", client.UserID(), "client", client.ID(), "limit", d.opts.MaxConnections,
		)
		connectSpan.AddEvent("disconnect", trace.WithAttributes(attribute.String("reason", "connection limit reached")))
		client.Disconnect(centrifuge.DisconnectConnectionLimit)
		return
	}
	var semaphore chan struct{}
	if clientConcurrency > 1 {
		semaphore = make(chan struct{}, clientConcurrency)
	}
	logger.Debug("Client connected", "user", client.UserID(), "client", client.ID())
	connectedAt := time.Now()

	// Called when client issues RPC (async request over Live connection).
	client.OnRPC(func(e centrifuge.RPCEvent, cb centrifuge.RPCCallback) {
		ctx, span := tracer.Start(client.Context(), "live.OnRPC")
		// We finish span when calling callback, which can be done on a separate goroutine.

		span.SetAttributes(
			attribute.String("method", e.Method),
			attribute.String("data", string(e.Data)),
		)

		cbWithSpan := func(resp centrifuge.RPCReply, err error) {
			defer span.End()
			if err != nil {
				span.SetStatus(codes.Error, err.Error())
			} else {
				span.AddEvent("result", trace.WithAttributes(attribute.String("data", string(resp.Data))))
				span.SetStatus(codes.Ok, "")
			}
			cb(resp, err)
		}

		err := runConcurrentlyIfNeeded(ctx, semaphore, func() {
			cbWithSpan(d.OnRPC(ctx, client, e))
		})
		if err != nil {
			cbWithSpan(centrifuge.RPCReply{}, err)
		}
	})

	// Called when client subscribes to the channel.
	client.OnSubscribe(func(e centrifuge.SubscribeEvent, cb centrifuge.SubscribeCallback) {
		ctx, span := tracer.Start(client.Context(), "live.OnSubscribe")
		// We finish span when calling callback, which can be done on a separate goroutine.

		span.SetAttributes(
			attribute.String("channel", e.Channel),
			attribute.String("data", string(e.Data)),
		)

		cbWithSpan := func(resp centrifuge.SubscribeReply, err error) {
			defer span.End()
			d.observeSubscribe(e.Channel, err)
			if err != nil {
				span.SetStatus(codes.Error, err.Error())
			} else {
				span.SetStatus(codes.Ok, "")
			}
			cb(resp, err)
		}

		err := runConcurrentlyIfNeeded(ctx, semaphore, func() {
			cbWithSpan(d.OnSubscribe(ctx, client, e))
		})
		if err != nil {
			cbWithSpan(centrifuge.SubscribeReply{}, err)
		}
	})

	// Called when a client publishes to the channel.
	// In general, we should prefer writing to the HTTP API, but this
	// allows some simple prototypes to work quickly.
	client.OnPublish(func(e centrifuge.PublishEvent, cb centrifuge.PublishCallback) {
		ctx, span := tracer.Start(client.Context(), "live.OnPublish")
		// We finish span when calling callback, which can be done on a separate goroutine.

		span.SetAttributes(
			attribute.String("channel", e.Channel),
			attribute.String("data", string(e.Data)),
		)

		cbWithSpan := func(resp centrifuge.PublishReply, err error) {
			defer span.End()
			if err != nil {
				span.SetStatus(codes.Error, err.Error())
			} else {
				span.SetStatus(codes.Ok, "")
			}
			cb(resp, err)
		}

		err := runConcurrentlyIfNeeded(ctx, semaphore, func() {
			cbWithSpan(d.OnPublish(ctx, client, e))
		})
		if err != nil {
			cbWithSpan(centrifuge.PublishReply{}, err)
		}
	})

	// We don't need to do anything on unsubscribe, but we create tracing span with channel name.
	client.OnUnsubscribe(func(e centrifuge.UnsubscribeEvent) {
		_, span := tracer.Start(client.Context(), "live.OnUnsubscribe")
		defer span.End()

		span.SetAttributes(
			attribute.String("channel", e.Channel),
		)
	})

	client.OnDisconnect(func(e centrifuge.DisconnectEvent) {
		_, span := tracer.Start(client.Context(), "live.OnDisconnect")
		defer span.End()

		d.observeDisconnect(e.Code)

		reason := e.Reason
		if e.Code == 3001 { // Shutdown
			return
		}
		logger.Debug("Client disconnected", "user", client.UserID(), "client", client.ID(), "reason", reason, "elapsed", time.Since(connectedAt))
	})
}

func runConcurrentlyIfNeeded(ctx context.Context, semaphore chan struct{}, fn func()) error {
	if cap(semaphore) > 1 {
		select {
		case semaphore <- struct{}{}:
		case <-ctx.Done():
			return ctx.Err()
		}
		go func() {
			defer func() { <-semaphore }()
			fn()
		}()
	} else {
		// No need in separate goroutines.
		fn()
	}
	return nil
}

func (d *Dispatcher) checkIDTokenExpirationAndRefresh(user identity.Requester, client *centrifuge.Client) bool {
	if !identity.IsIDTokenExpired(user) {
		return false
	}

	logger.Debug("ID token expired, triggering refresh", "user", client.UserID(), "client", client.ID())
	err := d.node.Refresh(client.UserID(), centrifuge.WithRefreshExpired(true))
	if err != nil {
		logger.Error("Failed to refresh expired ID token", "user", client.UserID(), "client", client.ID(), "error", err)
		return true
	}

	return false
}

// OnRPC answers a client RPC. No RPC methods are available yet.
func (d *Dispatcher) OnRPC(ctx context.Context, client *centrifuge.Client, e centrifuge.RPCEvent) (centrifuge.RPCReply, error) {
	logger.Debug("Client calls RPC", "user", client.UserID(), "client", client.ID(), "method", e.Method)
	if e.Method != "grafana.query" {
		return centrifuge.RPCReply{}, centrifuge.ErrorMethodNotFound
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		logger.Error("No user found in context", "user", client.UserID(), "client", client.ID(), "method", e.Method)
		return centrifuge.RPCReply{}, centrifuge.ErrorInternal
	}

	// Check if ID token is expired and trigger refresh if needed
	if expired := d.checkIDTokenExpirationAndRefresh(user, client); expired {
		return centrifuge.RPCReply{}, errorExpiredTemporary
	}

	// RPC events not available
	return centrifuge.RPCReply{}, centrifuge.ErrorNotAvailable
}

// OnSubscribe authorizes and answers a client subscription.
func (d *Dispatcher) OnSubscribe(ctx context.Context, client *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
	logger.Debug("Client wants to subscribe", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)

	user, err := identity.GetRequester(ctx)
	if err != nil {
		logger.Error("No user found in context", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
	}

	// Check if ID token is expired and trigger refresh if needed
	if expired := d.checkIDTokenExpirationAndRefresh(user, client); expired {
		return centrifuge.SubscribeReply{}, errorExpiredTemporary
	}

	// See a detailed comment for StripK8sNamespace about orgID management in Live.
	info, channel, err := orgchannel.StripK8sNamespace(e.Channel)
	if err != nil {
		logger.Error("Error parsing channel", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
	}

	ns := user.GetNamespace()
	if ns != info.Value {
		logger.Info("Error subscribing: wrong namespace", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorPermissionDenied
	}

	var reply model.SubscribeReply
	var status backend.SubscribeStreamStatus
	var ruleFound bool

	if d.opts.Pipeline != nil {
		rule, ok, err := d.opts.Pipeline.Get(ns, channel)
		if err != nil {
			logger.Error("Error getting channel rule", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
			return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
		}
		ruleFound = ok
		if ok {
			if rule.SubscribeAuth != nil {
				ok, err := rule.SubscribeAuth.CanSubscribe(ctx, user)
				if err != nil {
					logger.Error("Error checking subscribe permissions", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
					return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
				}
				if !ok {
					// using HTTP error codes for WS errors too.
					code, text := SubscribeStatusToHTTPError(backend.SubscribeStreamStatusPermissionDenied)
					return centrifuge.SubscribeReply{}, &centrifuge.Error{Code: uint32(code), Message: text}
				}
			}
			if len(rule.Subscribers) > 0 {
				var err error
				for _, sub := range rule.Subscribers {
					reply, status, err = sub.Subscribe(ctx, pipeline.Vars{
						NS:      ns,
						Channel: channel,
					}, e.Data)
					if err != nil {
						logger.Error("Error channel rule subscribe", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
						return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
					}
					if status != backend.SubscribeStreamStatusOK {
						break
					}
				}
			}
		}
	}
	if !ruleFound {
		handler, addr, err := d.GetChannelHandler(ctx, user, channel)
		if err != nil {
			return centrifuge.SubscribeReply{}, channelHandlerError(client, e.Channel, err)
		}
		reply, status, err = handler.OnSubscribe(ctx, user, model.SubscribeEvent{
			Channel: channel,
			Path:    addr.Path,
			Data:    e.Data,
		})
		if err != nil {
			logger.Error("Error calling channel handler subscribe", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
			if status != backend.SubscribeStreamStatusOK {
				return centrifuge.SubscribeReply{}, subscribeStatusToCentrifugeError(status)
			}
			return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
		}
	}
	if status != backend.SubscribeStreamStatusOK {
		// using HTTP error codes for WS errors too.
		code, text := SubscribeStatusToHTTPError(status)
		logger.Debug("Return custom subscribe error", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "code", code)
		return centrifuge.SubscribeReply{}, &centrifuge.Error{Code: uint32(code), Message: text}
	}
	logger.Debug("Client subscribed", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
	return centrifuge.SubscribeReply{
		Options: centrifuge.SubscribeOptions{
			EmitPresence:   reply.Presence,
			EmitJoinLeave:  reply.JoinLeave,
			PushJoinLeave:  reply.JoinLeave,
			EnableRecovery: reply.Recover,
			Data:           reply.Data,
		},
	}, nil
}

// OnPublish authorizes and answers a client publication.
func (d *Dispatcher) OnPublish(ctx context.Context, client *centrifuge.Client, e centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
	logger.Debug("Client wants to publish", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)

	user, err := identity.GetRequester(ctx)
	if err != nil {
		logger.Error("No user found in context", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.PublishReply{}, centrifuge.ErrorInternal
	}

	// Check if ID token is expired and trigger refresh if needed
	if expired := d.checkIDTokenExpirationAndRefresh(user, client); expired {
		return centrifuge.PublishReply{}, errorExpiredTemporary
	}

	// See a detailed comment for StripK8sNamespace about orgID management in Live.
	ns, channel, err := orgchannel.StripK8sNamespace(e.Channel)
	if err != nil {
		logger.Error("Error parsing channel", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.PublishReply{}, centrifuge.ErrorInternal
	}

	if user.GetNamespace() != ns.Value {
		logger.Info("Error publishing: wrong namespace", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.PublishReply{}, centrifuge.ErrorPermissionDenied
	}

	if d.opts.Pipeline != nil {
		rule, ok, err := d.opts.Pipeline.Get(ns.Value, channel)
		if err != nil {
			logger.Error("Error getting channel rule", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
			return centrifuge.PublishReply{}, centrifuge.ErrorInternal
		}
		if ok {
			if rule.PublishAuth != nil {
				ok, err := rule.PublishAuth.CanPublish(ctx, user)
				if err != nil {
					logger.Error("Error checking publish permissions", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
					return centrifuge.PublishReply{}, centrifuge.ErrorInternal
				}
				if !ok {
					// using HTTP error codes for WS errors too.
					code, text := PublishStatusToHTTPError(backend.PublishStreamStatusPermissionDenied)
					return centrifuge.PublishReply{}, &centrifuge.Error{Code: uint32(code), Message: text}
				}
			} else {
				if !user.HasRole(authlib.RoleAdmin) {
					// using HTTP error codes for WS errors too.
					code, text := PublishStatusToHTTPError(backend.PublishStreamStatusPermissionDenied)
					return centrifuge.PublishReply{}, &centrifuge.Error{Code: uint32(code), Message: text}
				}
			}
			_, err := d.opts.Pipeline.ProcessInput(ctx, ns.Value, channel, e.Data)
			if err != nil {
				logger.Error("Error processing input", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
				return centrifuge.PublishReply{}, centrifuge.ErrorInternal
			}
			return centrifuge.PublishReply{
				Result: &centrifuge.PublishResult{},
			}, nil
		}
	}

	handler, addr, err := d.GetChannelHandler(ctx, user, channel)
	if err != nil {
		return centrifuge.PublishReply{}, channelHandlerError(client, e.Channel, err)
	}
	reply, status, err := handler.OnPublish(client.Context(), user, model.PublishEvent{
		Channel: channel,
		Path:    addr.Path,
		Data:    e.Data,
	})
	if err != nil {
		logger.Error("Error calling channel handler publish", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.PublishReply{}, centrifuge.ErrorInternal
	}

	if status != backend.PublishStreamStatusOK {
		// using HTTP error codes for WS errors too.
		code, text := PublishStatusToHTTPError(status)
		logger.Debug("Return custom publish error", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "code", code)
		return centrifuge.PublishReply{}, &centrifuge.Error{Code: uint32(code), Message: text}
	}
	centrifugeReply := centrifuge.PublishReply{
		Options: centrifuge.PublishOptions{
			HistorySize: reply.HistorySize,
			HistoryTTL:  reply.HistoryTTL,
		},
	}
	if reply.Data != nil {
		// If data is not nil then we published it manually and tell Centrifuge
		// publication result so Centrifuge won't publish itself.
		result, err := d.node.Publish(e.Channel, reply.Data)
		if err != nil {
			logger.Error("Error publishing", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err, "data", string(reply.Data))
			return centrifuge.PublishReply{}, centrifuge.ErrorInternal
		}
		centrifugeReply.Result = &result
	}
	logger.Debug("Publication successful", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
	return centrifugeReply, nil
}

func channelHandlerError(client *centrifuge.Client, channel string, err error) *centrifuge.Error {
	switch {
	case errors.Is(err, live.ErrInvalidChannelID):
		logger.Info("Invalid channel ID", "user", client.UserID(), "client", client.ID(), "channel", channel)
		return &centrifuge.Error{Code: uint32(http.StatusBadRequest), Message: "invalid channel ID"}
	case errors.Is(err, ErrScopeNotAvailable):
		logger.Debug("Channel scope not available", "user", client.UserID(), "client", client.ID(), "channel", channel)
		return centrifuge.ErrorNotAvailable
	default:
		logger.Error("Error getting channel handler", "user", client.UserID(), "client", client.ID(), "channel", channel, "error", err)
		return centrifuge.ErrorInternal
	}
}

func subscribeStatusToCentrifugeError(status backend.SubscribeStreamStatus) *centrifuge.Error {
	switch status {
	case backend.SubscribeStreamStatusNotFound:
		return centrifuge.ErrorUnknownChannel
	case backend.SubscribeStreamStatusPermissionDenied:
		return centrifuge.ErrorPermissionDenied
	default:
		return centrifuge.ErrorInternal
	}
}

// SubscribeStatusToHTTPError maps a subscribe status to the HTTP status code
// and text Live reports, over websockets too.
func SubscribeStatusToHTTPError(status backend.SubscribeStreamStatus) (int, string) {
	switch status {
	case backend.SubscribeStreamStatusNotFound:
		return http.StatusNotFound, http.StatusText(http.StatusNotFound)
	case backend.SubscribeStreamStatusPermissionDenied:
		return http.StatusForbidden, http.StatusText(http.StatusForbidden)
	default:
		logger.Warn("Unknown subscribe status", "status", status)
		return http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError)
	}
}

// PublishStatusToHTTPError maps a publish status to the HTTP status code and
// text Live reports, over websockets too.
func PublishStatusToHTTPError(status backend.PublishStreamStatus) (int, string) {
	switch status {
	case backend.PublishStreamStatusNotFound:
		return http.StatusNotFound, http.StatusText(http.StatusNotFound)
	case backend.PublishStreamStatusPermissionDenied:
		return http.StatusForbidden, http.StatusText(http.StatusForbidden)
	default:
		logger.Warn("Unknown publish status", "status", status)
		return http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError)
	}
}

// GetChannelHandler gives thread-safe access to the handler of a channel
// (scope/namespace/path, without the k8s namespace).
func (d *Dispatcher) GetChannelHandler(ctx context.Context, user identity.Requester, channel string) (model.ChannelHandler, live.Channel, error) {
	addr, err := live.ParseChannel(channel)
	if err != nil {
		return nil, live.Channel{}, err
	}

	// Factories can bind handlers to tenant-specific state, such as a
	// datasource's plugin, even when the channel name is the same.
	key := orgchannel.PrependK8sNamespace(user.GetNamespace(), channel)
	d.channelsMu.RLock()
	c, ok := d.channels[key]
	d.channelsMu.RUnlock() // defer? but then you can't lock further down
	if ok {
		logger.Debug("Found cached channel handler", "channel", channel)
		return c, addr, nil
	}

	d.channelsMu.Lock()
	defer d.channelsMu.Unlock()
	c, ok = d.channels[key] // may have filled in while locked
	if ok {
		logger.Debug("Found cached channel handler", "channel", channel)
		return c, addr, nil
	}

	getter, err := d.GetChannelHandlerFactory(ctx, user, addr.Scope, addr.Namespace)
	if err != nil {
		return nil, addr, fmt.Errorf("error getting channel handler factory: %w", err)
	}

	// First access will initialize.
	c, err = getter.GetHandlerForPath(addr.Path)
	if err != nil {
		return nil, addr, fmt.Errorf("error getting handler for path: %w", err)
	}

	logger.Info("Initialized channel handler", "channel", channel, "address", addr)
	d.channels[key] = c
	return c, addr, nil
}

// GetChannelHandlerFactory gets the ChannelHandlerFactory for a namespace
// within a scope.
func (d *Dispatcher) GetChannelHandlerFactory(ctx context.Context, user identity.Requester, scope string, namespace string) (model.ChannelHandlerFactory, error) {
	switch scope {
	case live.ScopeGrafana, live.ScopeWatch, live.ScopePlugin, live.ScopeDatasource, live.ScopeStream:
	default:
		return nil, fmt.Errorf("invalid scope: %q", scope)
	}
	h, ok := d.opts.Scopes[scope]
	if !ok || h == nil {
		return nil, fmt.Errorf("%w: %q", ErrScopeNotAvailable, scope)
	}
	return h.GetHandlerFactory(ctx, user, namespace)
}
