package features

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/live/model"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"
)

// numLocalSubscribersGetter reports how many clients of this pod are subscribed
// to a channel. Centrifuge has no unsubscribe hook we can hang teardown off, so
// presence polling is how a watch learns its last subscriber left.
type numLocalSubscribersGetter interface {
	GetNumLocalSubscribers(channel string) (int, error)
}

// defaultCheckInterval and defaultMaxZeroChecks mirror runstream.Manager: poll
// subscriber presence every 5s and stop after 3 consecutive empty checks, so
// navigating away and straight back reuses the watch instead of reopening it.
const (
	defaultCheckInterval = 5 * time.Second
	defaultMaxZeroChecks = 3
)

// probeTimeout bounds the subscribe-time authorization request. Subscribing is
// interactive, so a stuck apiserver must fail the subscription rather than hold
// the websocket handler.
const probeTimeout = 10 * time.Second

// watchKey identifies one upstream watch.
//
// channel is set only when the watch belongs to a single subscriber, which is
// what makes the apiserver authorize the stream for that user. A shared watch
// leaves it empty, so every subscriber of the same resource in the same
// namespace resolves to one key. Mixing both shapes in the map is harmless: a
// watcher created in one mode simply never matches a lookup made in the other
// and ages out when its subscribers leave.
type watchKey struct {
	namespace string
	gvr       schema.GroupVersionResource
	name      string
	channel   string
}

// WatchRunner will start a watch task and broadcast results
type WatchRunner struct {
	publisher      model.ChannelPublisher
	subscribers    numLocalSubscribersGetter
	configProvider apiserver.RestConfigProvider

	// newClient is a seam for tests, which cannot stand up a loopback apiserver.
	newClient func(ctx context.Context) (dynamic.Interface, error)

	checkInterval time.Duration
	maxZeroChecks int

	watchingMu sync.Mutex
	watching   map[watchKey]*watcher
}

func NewWatchRunner(publisher model.ChannelPublisher, subscribers numLocalSubscribersGetter, configProvider apiserver.RestConfigProvider) *WatchRunner {
	r := &WatchRunner{
		publisher:      publisher,
		subscribers:    subscribers,
		configProvider: configProvider,
		checkInterval:  defaultCheckInterval,
		maxZeroChecks:  defaultMaxZeroChecks,
		watching:       make(map[watchKey]*watcher),
	}
	r.newClient = func(ctx context.Context) (dynamic.Interface, error) {
		cfg, err := r.configProvider.GetRestConfig(ctx)
		if err != nil {
			return nil, err
		}
		return dynamic.NewForConfig(cfg)
	}
	return r
}

func (b *WatchRunner) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return b, nil // all dashboards share the same handler
}

// Valid paths look like: {version}/{resource}[={name}]/{user.uid}
// * v0alpha1/dashboards/u12345
// * v0alpha1/dashboards=ABCD/u12345
func (b *WatchRunner) OnSubscribe(ctx context.Context, u identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	// To make sure we do not share resources across users, include the UID in the path
	userID := u.GetIdentifier()
	if u.GetIdentityType() == types.TypeAnonymous {
		userID = "anonymous"
	} else if userID == "" {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, fmt.Errorf("missing user identity")
	}

	// Parse before anything else: it carries the exact user check, and both it and
	// the group gate below must run on every subscribe, not only when a watch is
	// created. Reusing an existing watcher without them would let a user attach to
	// a stream opened for someone else.
	gvr, name, err := parseWatchRequest(e.Channel, userID)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, err
	}

	// Test this with only provisioning support -- then we can evaluate a broader rollout
	if gvr.Group != provisioning.GROUP {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied,
			fmt.Errorf("watching provisioned resources is only allowed for provisioning (for now)")
	}

	namespace := u.GetNamespace()
	uclient, err := b.newClient(ctx)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, err
	}
	client := uclient.Resource(gvr).Namespace(namespace)

	key := watchKey{namespace: namespace, gvr: gvr, name: name}
	shared := b.sharedWatch(ctx)
	if shared {
		// One stream cannot carry per-user authorization, so authorize the user
		// here instead - on every subscribe, including one that only attaches to
		// an existing watcher.
		if err := authorizeSubscriber(ctx, u, client); err != nil {
			return model.SubscribeReply{}, watchErrorStatus(err), err
		}
	} else {
		key.channel = e.Channel
	}

	b.watchingMu.Lock()
	defer b.watchingMu.Unlock()

	if current, ok := b.watching[key]; ok && current.attach(e.Channel) {
		return model.SubscribeReply{
			JoinLeave: false,
			Presence:  false,
			Recover:   false,
		}, backend.SubscribeStreamStatusOK, nil
	}

	// The watch outlives this subscribe request, so it cannot borrow its context.
	watchCtx, cancel := context.WithCancel(watchIdentity(u, shared))

	opts := v1.ListOptions{}
	if len(name) > 1 {
		opts.FieldSelector = "metadata.name=" + name
	}

	// Support resourceVersion from subscription data. Only the subscriber that
	// opens the watch gets its resourceVersion honoured; one that attaches later
	// starts from wherever the stream is, and relies on the client's own
	// resourceVersion guard and polling fallback to notice what it missed. The
	// same gap already applies to a second tab of the same user.
	if len(e.Data) > 0 {
		var subData struct {
			ResourceVersion string `json:"resourceVersion,omitempty"`
		}
		if err := json.Unmarshal(e.Data, &subData); err == nil && subData.ResourceVersion != "" {
			opts.ResourceVersion = subData.ResourceVersion
		}
	}

	stream, err := client.Watch(watchCtx, opts)
	if err != nil {
		cancel()
		return model.SubscribeReply{}, watchErrorStatus(err), err
	}

	current := &watcher{
		runner:      b,
		key:         key,
		ns:          namespace,
		publisher:   b.publisher,
		subscribers: b.subscribers,
		watch:       stream,
		cancel:      cancel,
		channels:    map[string]int{e.Channel: 0},
	}

	b.watching[key] = current
	go current.run(watchCtx)

	return model.SubscribeReply{
		JoinLeave: false, // need unsubscribe envents
		Presence:  false,
		Recover:   false,
	}, backend.SubscribeStreamStatusOK, nil
}

// remove drops the watcher from the registry, but only when it is still the one
// registered: a successor may already have taken the key while this one stopped.
func (b *WatchRunner) remove(key watchKey, w *watcher) {
	b.watchingMu.Lock()
	defer b.watchingMu.Unlock()
	if b.watching[key] == w {
		delete(b.watching, key)
	}
}

// sharedWatch reports whether one watch should serve every subscriber of a
// resource rather than one watch per subscriber.
func (b *WatchRunner) sharedWatch(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagProvisioningSharedLiveWatch, false, openfeature.TransactionContext(ctx))
}

// watchIdentity returns the context identity the upstream watch runs under. A
// per-subscriber watch carries the subscriber, which is what the loopback
// transport hands the apiserver and what authorizes the stream. A shared watch
// cannot, so it runs as the service - still pinned to the one namespace, so a
// stream can never span tenants - and authorizeSubscriber is what keeps users
// out of a resource they cannot read.
func watchIdentity(u identity.Requester, shared bool) context.Context {
	if shared {
		return identity.WithServiceIdentityForSingleNamespaceContext(context.Background(), u.GetNamespace())
	}
	return identity.WithRequester(context.Background(), u)
}

// authorizeSubscriber asks the apiserver whether this user may read the
// resource, standing in for the per-user watch a shared watcher replaces. A
// Limit=1 list is the cheapest request that runs the whole authorizer chain,
// and list is equivalent to watch for this group: the provisioning authorizer
// resolves get, list and watch to the same read permission. No field selector,
// because the check is for the collection.
//
// Authorizing the collection once is only equivalent to the apiserver's
// per-event filtering while authorization is uniform across a namespace, which
// holds for provisioning on two counts: none of its permissions carry a scope,
// and it is outside the unified storage RBAC allowlist, so the per-event
// checker resolves to allow-all. Revisit if either changes - a scope on a
// watched resource, or provisioning reaching the enforced path (its allowlist
// entry, or [unified_storage] authz_exemption_enabled without an exemption for
// it).
func authorizeSubscriber(ctx context.Context, u identity.Requester, client dynamic.ResourceInterface) error {
	ctx, cancel := context.WithTimeout(identity.WithRequester(ctx, u), probeTimeout)
	defer cancel()

	_, err := client.List(ctx, v1.ListOptions{Limit: 1})
	return err
}

// watchErrorStatus keeps an authorization failure recognizable to the frontend.
// Reporting every watch error as "unknown channel" hides a 403 behind a channel
// error, and the client's polling fallback is what then surfaces the real cause.
func watchErrorStatus(err error) backend.SubscribeStreamStatus {
	if apierrors.IsForbidden(err) || apierrors.IsUnauthorized(err) {
		return backend.SubscribeStreamStatusPermissionDenied
	}
	return backend.SubscribeStreamStatusNotFound
}

func parseWatchRequest(channel string, user string) (gvr schema.GroupVersionResource, name string, err error) {
	addr, err := live.ParseChannel(channel)
	if err != nil {
		return gvr, "", err
	}

	parts := strings.Split(addr.Path, "/")
	if len(parts) != 3 {
		return gvr, "", fmt.Errorf("expecting path: {version}/{resource}={name}/{user}")
	}
	if parts[2] != user {
		return gvr, "", fmt.Errorf("expecting user suffix: %s", user)
	}

	resource := strings.Split(parts[1], "=")
	gvr = schema.GroupVersionResource{
		Group:    addr.Namespace,
		Version:  parts[0],
		Resource: resource[0],
	}
	if len(resource) > 1 {
		name = resource[1]
	}
	return gvr, name, nil
}

// OnPublish is called when a client wants to broadcast on the websocket
func (b *WatchRunner) OnPublish(_ context.Context, u identity.Requester, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	return model.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("watch does not support publish")
}

type watcher struct {
	runner      *WatchRunner
	key         watchKey
	ns          string
	publisher   model.ChannelPublisher
	subscribers numLocalSubscribersGetter
	watch       watch.Interface
	cancel      context.CancelFunc

	mu       sync.Mutex
	stopping bool
	// channels maps a subscriber channel to its consecutive zero-subscriber
	// checks. A watcher with no channels left has nothing to publish to.
	channels map[string]int
}

// attach registers a subscriber channel and resets its idle count. It reports
// false once the watcher is stopping, so the caller opens a fresh watch rather
// than joining one that is already tearing down.
func (w *watcher) attach(channel string) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.stopping {
		return false
	}
	w.channels[channel] = 0
	return true
}

// detach drops a channel and reports how many remain.
func (w *watcher) detach(channel string) int {
	w.mu.Lock()
	defer w.mu.Unlock()
	delete(w.channels, channel)
	return len(w.channels)
}

// channelList snapshots the subscriber channels so publishing happens outside
// the lock: in HA mode the publisher writes to Redis and must not block attach.
func (w *watcher) channelList() []string {
	w.mu.Lock()
	defer w.mu.Unlock()
	channels := make([]string, 0, len(w.channels))
	for channel := range w.channels {
		channels = append(channels, channel)
	}
	return channels
}

// channelCount reports how many subscriber channels the watcher still serves.
func (w *watcher) channelCount() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return len(w.channels)
}

// idleChannels returns the channels that have had no local subscriber for
// maxZeroChecks consecutive polls. A channel whose count could not be read is
// left alone: a presence lookup failing is not evidence that nobody is
// listening, and treating it as such would tear down a live watch.
func (w *watcher) idleChannels(logger logging.Logger) []string {
	var idle []string
	for _, channel := range w.channelList() {
		full := orgchannel.PrependK8sNamespace(w.ns, channel)
		num, err := w.subscribers.GetNumLocalSubscribers(full)
		if err != nil {
			logger.Error("error checking num subscribers", "channel", full, "err", err)
			continue
		}

		w.mu.Lock()
		if _, ok := w.channels[channel]; !ok {
			// Detached while we were polling.
			w.mu.Unlock()
			continue
		}
		if num > 0 {
			w.channels[channel] = 0
		} else if w.channels[channel]++; w.channels[channel] >= w.runner.maxZeroChecks {
			idle = append(idle, channel)
		}
		w.mu.Unlock()
	}
	return idle
}

// stop is the watcher's only teardown path: it closes the upstream watch,
// cancels its context and unregisters it. stopping is set first and under
// w.mu alone, so a concurrent attach refuses before remove takes watchingMu —
// the two locks are never held in the opposite order.
func (w *watcher) stop() {
	w.mu.Lock()
	w.stopping = true
	w.mu.Unlock()

	w.watch.Stop()
	w.cancel()
	w.runner.remove(w.key, w)
}

func (b *watcher) run(ctx context.Context) {
	logger := logging.FromContext(ctx).With(
		"namespace", b.key.namespace,
		"resource", b.key.gvr.Resource,
		"name", b.key.name,
		"channel", b.key.channel, // empty for a shared watch
	)
	defer b.stop()

	ticker := time.NewTicker(b.runner.checkInterval)
	defer ticker.Stop()

	ch := b.watch.ResultChan()
	for {
		select {
		// This is sent when there are no longer any subscriptions
		case <-ctx.Done():
			logger.Info("context done")
			return

		case <-ticker.C:
			remaining := b.channelCount()
			for _, channel := range b.idleChannels(logger) {
				logger.Debug("no active subscribers, dropping channel", "channel", channel)
				remaining = b.detach(channel)
			}
			if remaining == 0 {
				logger.Debug("no active subscribers, stopping watch")
				return
			}

		// Each watch event
		case event, ok := <-ch:
			if !ok {
				logger.Info("watch stream broken")
				return // will force reconnect from the frontend
			}

			data, err := marshalWatchEvent(event)
			if err != nil {
				logger.Error("marshal error", "err", err)
				continue
			}

			for _, channel := range b.channelList() {
				if err := b.publisher(b.ns, channel, data); err != nil {
					logger.Error("publish error", "channel", channel, "err", err)
					// The channel is unusable; the frontend reconnects and resubscribes.
					if b.detach(channel) == 0 {
						return
					}
				}
			}
		}
	}
}

// marshalWatchEvent serializes a watch event to JSON. This is extracted from the
// run loop so that defer correctly returns the borrowed jsoniter stream each call.
func marshalWatchEvent(event watch.Event) ([]byte, error) {
	cfg := jsoniter.ConfigCompatibleWithStandardLibrary
	stream := cfg.BorrowStream(nil)
	defer cfg.ReturnStream(stream)

	stream.WriteObjectStart()
	stream.WriteObjectField("type")
	stream.WriteString(string(event.Type))
	stream.WriteMore()
	stream.WriteObjectField("object")
	stream.WriteVal(event.Object)
	stream.WriteObjectEnd()

	if stream.Error != nil {
		return nil, stream.Error
	}

	buf := stream.Buffer()
	data := make([]byte, len(buf))
	copy(data, buf)
	return data, nil
}
