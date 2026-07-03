package appplugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/watch"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	pluginregistry "github.com/grafana/grafana/pkg/plugins/manager/registry"
)

// newStoredObjectEventsOpener returns an opener that resolves the plugin's
// backend gRPC handle from the plugin manager registry at call time. The
// resolution is lazy because plugin processes start independently of the
// apiserver; the pusher's retry loop absorbs the window where the plugin
// isn't running yet. The handle is reached through the registry instead of
// plugins.Client so the org-wide client interface (and every middleware
// implementing it) stays untouched — see
// backendplugin.StoredObjectEventsStreamer for the production caveat.
func newStoredObjectEventsOpener(pluginRegistry pluginregistry.Service, pluginID string) storedObjectEventsOpener {
	return func(ctx context.Context) (storedObjectEventsStream, error) {
		p, exists := pluginRegistry.Plugin(ctx, pluginID, "")
		if !exists {
			return nil, fmt.Errorf("plugin %s is not registered", pluginID)
		}
		client, ok := p.Client()
		if !ok {
			return nil, fmt.Errorf("plugin %s has no backend client", pluginID)
		}
		streamer, ok := client.(backendplugin.StoredObjectEventsStreamer)
		if !ok {
			// Non-gRPC backends (e.g. core plugins) can't stream events.
			return nil, plugins.ErrMethodNotImplemented
		}
		return streamer.StreamStoredObjectEvents(ctx)
	}
}

// storedObjectEventsStream is one open bidirectional event stream to the
// plugin backend: Grafana pushes change events with Send and receives the
// plugin's subscription messages with RecvSubscription. Each subscription
// message carries the full replacement set of kind names the plugin wants
// events for (not a delta); an empty set means "stop pushing, keep the
// stream open".
type storedObjectEventsStream interface {
	Send(event *backend.StoredObjectEvent) error
	RecvSubscription() ([]string, error)
	Close() error
}

// storedObjectEventsOpener opens the event stream to the plugin backend.
// Opening is expected to be lazy about plugin resolution: plugin processes
// start independently of the apiserver, and the pusher's retry loop absorbs
// the window where the plugin isn't running yet.
type storedObjectEventsOpener func(ctx context.Context) (storedObjectEventsStream, error)

// storedObjectWatcher is the subset of the REST store the event pusher needs.
// *registry.Store (what installStoredObjectStorage creates per kind)
// satisfies it.
type storedObjectWatcher interface {
	Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error)
}

// storedObjectEventSource pairs a declared kind with the store it can be
// watched through.
type storedObjectEventSource struct {
	kind    string
	watcher storedObjectWatcher
}

// GetPostStartHooks starts the stored-object event pusher once the apiserver
// is up. Registered only for builders that declare stored objects and have an
// events stream opener wired; everything else gets no hook and no goroutine.
func (b *AppPluginAPIBuilder) GetPostStartHooks() (map[string]genericapiserver.PostStartHookFunc, error) {
	kinds, err := b.parseStoredObjects()
	if err != nil {
		return nil, err
	}
	if len(kinds) == 0 || b.eventsOpener == nil {
		return nil, nil
	}
	hookName := fmt.Sprintf("appplugin-%s-stored-object-events", b.pluginJSON.ID)
	return map[string]genericapiserver.PostStartHookFunc{
		hookName: func(hookCtx genericapiserver.PostStartHookContext) error {
			// eventWatchers is populated by UpdateAPIGroupInfo, which runs
			// while the server is assembled — before any post-start hook
			// fires — so the slice is final by the time this executes.
			if len(b.eventWatchers) == 0 {
				return nil
			}
			pusher := &storedObjectEventsPusher{
				pluginID:       b.pluginJSON.ID,
				sources:        b.eventWatchers,
				open:           b.eventsOpener,
				initialBackoff: time.Second,
				maxBackoff:     30 * time.Second,
				log:            logging.DefaultLogger.With("logger", "appplugin-stored-object-events", "pluginId", b.pluginJSON.ID),
			}
			go pusher.run(hookCtx.Context)
			return nil
		},
	}, nil
}

// storedObjectEventsPusher owns one plugin's event stream: a single goroutine
// per plugin (not per kind) that opens the stream, waits for the plugin's
// subscription, and fans watch events for the subscribed kinds into it.
type storedObjectEventsPusher struct {
	pluginID       string
	sources        []storedObjectEventSource
	open           storedObjectEventsOpener
	initialBackoff time.Duration
	maxBackoff     time.Duration
	log            logging.Logger
}

// run keeps one stream session alive until ctx is canceled, reconnecting with
// capped exponential backoff. A reconnect starts the protocol over: nothing
// is pushed until the plugin subscribes again on the fresh stream.
func (p *storedObjectEventsPusher) run(ctx context.Context) {
	backoff := p.initialBackoff
	for {
		started := time.Now()
		err := p.runOnce(ctx)
		if ctx.Err() != nil {
			return
		}
		wait := backoff
		if isStoredObjectEventsUnimplemented(err) {
			// The plugin binary doesn't serve the events service; re-check
			// only at the slowest cadence instead of hammering it.
			p.log.Debug("plugin does not implement stored object events", "error", err)
			wait = p.maxBackoff
			backoff = p.maxBackoff
		} else {
			if err != nil {
				p.log.Warn("stored object event stream failed, reconnecting", "error", err)
			}
			// A session that outlived the backoff cap was healthy; restart
			// the ladder instead of pinning every future reconnect at the cap.
			if time.Since(started) > p.maxBackoff {
				backoff = p.initialBackoff
				wait = backoff
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
		}
		backoff *= 2
		if backoff > p.maxBackoff {
			backoff = p.maxBackoff
		}
	}
}

// runOnce runs a single stream session: open, wait for subscriptions, push
// events. Any stream or watch error tears the whole session down (both sides
// closed) and is returned so run can reconnect.
func (p *storedObjectEventsPusher) runOnce(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	stream, err := p.open(ctx)
	if err != nil {
		return fmt.Errorf("opening stored object event stream for plugin %s: %w", p.pluginID, err)
	}

	events := make(chan *backend.StoredObjectEvent)
	// One buffered slot suffices for the error channels: the first error
	// already tears the session down, and senders never block on the rest.
	watchErrs := make(chan error, 1)
	subErrs := make(chan error, 1)
	subs := make(chan []string)

	var wg sync.WaitGroup
	defer func() {
		// Cancel before closing so watch forwarders and a hung plugin can't
		// block teardown; the SDK side treats cancellation as stream teardown.
		cancel()
		_ = stream.Close()
		wg.Wait()
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			kinds, err := stream.RecvSubscription()
			if err != nil {
				select {
				case subErrs <- err:
				default:
				}
				return
			}
			select {
			case subs <- kinds:
			case <-ctx.Done():
				return
			}
		}
	}()

	// Nothing is watched — and therefore nothing pushed — until the plugin
	// sends its first subscription message.
	active := map[string]context.CancelFunc{}

	for {
		select {
		case <-ctx.Done():
			return nil
		case err := <-subErrs:
			return fmt.Errorf("stored object events subscription stream for plugin %s: %w", p.pluginID, err)
		case err := <-watchErrs:
			return err
		case kinds := <-subs:
			p.applySubscription(ctx, kinds, active, &wg, events, watchErrs)
		case ev := <-events:
			if err := stream.Send(ev); err != nil {
				return fmt.Errorf("pushing stored object event to plugin %s: %w", p.pluginID, err)
			}
		}
	}
}

// applySubscription reconciles the running kind watches against the plugin's
// latest subscription message, which is the full desired set: newly wanted
// kinds get a watch, no-longer-wanted kinds have theirs canceled.
func (p *storedObjectEventsPusher) applySubscription(ctx context.Context, kinds []string, active map[string]context.CancelFunc, wg *sync.WaitGroup, events chan<- *backend.StoredObjectEvent, watchErrs chan<- error) {
	want := make(map[string]struct{}, len(kinds))
	for _, k := range kinds {
		want[k] = struct{}{}
	}
	for kind, cancelWatch := range active {
		if _, ok := want[kind]; !ok {
			cancelWatch()
			delete(active, kind)
		}
	}
	for kind := range want {
		if _, ok := active[kind]; ok {
			continue
		}
		src, ok := p.source(kind)
		if !ok {
			p.log.Warn("plugin subscribed to an undeclared stored object kind", "kind", kind)
			continue
		}
		// The watch runs outside any request, so it must carry its own
		// identity; the wildcard-namespace service identity lets one watch
		// span every org namespace (no namespace on the context means the
		// store watches all of them).
		watchCtx, cancelWatch := context.WithCancel(identity.WithServiceIdentityContext(ctx, 0))
		// An empty resource version already gives only-new semantics here:
		// apistore requests SendInitialEvents=false and unified storage
		// resolves an empty RV to the current head before streaming, so
		// pre-existing objects are never replayed as ADDED on (re)subscribe.
		w, err := src.watcher.Watch(watchCtx, &metainternalversion.ListOptions{})
		if err != nil {
			cancelWatch()
			select {
			case watchErrs <- fmt.Errorf("starting watch for %s: %w", kind, err):
			default:
			}
			return
		}
		active[kind] = cancelWatch
		wg.Add(1)
		go func(kind string, w watch.Interface, wctx context.Context) {
			defer wg.Done()
			defer w.Stop()
			p.forwardWatchEvents(wctx, kind, w, events, watchErrs)
		}(kind, w, watchCtx)
	}
}

// forwardWatchEvents maps one kind's watch events into stored object events
// on the shared channel until its context is canceled or the watch dies.
func (p *storedObjectEventsPusher) forwardWatchEvents(ctx context.Context, kind string, w watch.Interface, events chan<- *backend.StoredObjectEvent, watchErrs chan<- error) {
	fail := func(err error) {
		// An unsubscribe cancels this kind's context, which also closes the
		// watch; only unexpected failures should tear the session down.
		if ctx.Err() != nil {
			return
		}
		select {
		case watchErrs <- err:
		default:
		}
	}
	for {
		select {
		case <-ctx.Done():
			return
		case ev, ok := <-w.ResultChan():
			if !ok {
				fail(fmt.Errorf("watch for %s closed unexpectedly", kind))
				return
			}
			if ev.Type == watch.Error {
				fail(fmt.Errorf("watch for %s reported an error event: %v", kind, ev.Object))
				return
			}
			mapped, ok := p.mapWatchEvent(kind, ev)
			if !ok {
				continue
			}
			select {
			case events <- mapped:
			case <-ctx.Done():
				return
			}
		}
	}
}

// mapWatchEvent converts a watch event into the SDK event shape, or reports
// false for event types that carry no object change (e.g. bookmarks).
func (p *storedObjectEventsPusher) mapWatchEvent(kind string, ev watch.Event) (*backend.StoredObjectEvent, bool) {
	var eventType backend.StoredObjectEventType
	switch ev.Type {
	case watch.Added:
		eventType = backend.StoredObjectEventCreated
	case watch.Modified:
		eventType = backend.StoredObjectEventUpdated
	case watch.Deleted:
		eventType = backend.StoredObjectEventDeleted
	default:
		return nil, false
	}
	raw, err := json.Marshal(ev.Object)
	if err != nil {
		p.log.Warn("dropping stored object event that failed to marshal", "kind", kind, "error", err)
		return nil, false
	}
	namespace := ""
	if acc, err := meta.Accessor(ev.Object); err == nil {
		namespace = acc.GetNamespace()
	}
	return &backend.StoredObjectEvent{
		PluginContext: p.eventPluginContext(namespace),
		Kind:          kind,
		Type:          eventType,
		ObjectBytes:   raw,
	}, true
}

// eventPluginContext builds the minimal plugin context for a pushed event.
// Full settings resolution (app instance settings, secure values) is skipped
// on purpose: the SDK routes events on PluginID and Namespace, and loading
// settings per event would turn every write into an extra storage read.
func (p *storedObjectEventsPusher) eventPluginContext(namespace string) backend.PluginContext {
	return backend.PluginContext{
		PluginID:  p.pluginID,
		Namespace: namespace,
	}
}

func (p *storedObjectEventsPusher) source(kind string) (storedObjectEventSource, bool) {
	for _, s := range p.sources {
		if s.kind == kind {
			return s, true
		}
	}
	return storedObjectEventSource{}, false
}

// isStoredObjectEventsUnimplemented reports whether the error means the
// plugin binary doesn't serve the events service at all, as opposed to a
// transient stream failure. The manual unwrap covers gRPC status errors that
// were wrapped with %w along the way.
func isStoredObjectEventsUnimplemented(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, plugins.ErrMethodNotImplemented) {
		return true
	}
	for e := err; e != nil; e = errors.Unwrap(e) {
		if s, ok := grpcstatus.FromError(e); ok && s.Code() == codes.Unimplemented {
			return true
		}
	}
	return false
}
