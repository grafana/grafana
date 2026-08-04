package features

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
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

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/live/model"
)

// WatchRunner will start a watch task and broadcast results
type WatchRunner struct {
	publisher      model.ChannelPublisher
	configProvider apiserver.RestConfigProvider

	watchingMu sync.Mutex
	watching   map[string]*watcher
}

func NewWatchRunner(publisher model.ChannelPublisher, configProvider apiserver.RestConfigProvider) *WatchRunner {
	return &WatchRunner{
		publisher:      publisher,
		configProvider: configProvider,
		watching:       make(map[string]*watcher),
	}
}

func (b *WatchRunner) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return b, nil // all dashboards share the same handler
}

// Valid paths look like: {version}/{resource}[={name}]/{user.uid}
// * v0alpha1/dashboards/u12345
// * v0alpha1/dashboards=ABCD/u12345
func (b *WatchRunner) OnSubscribe(_ context.Context, u identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	// To make sure we do not share resources across users, include the UID in the path
	userID := u.GetIdentifier()
	if u.GetIdentityType() == types.TypeAnonymous {
		userID = "anonymous"
	} else if userID == "" {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, fmt.Errorf("missing user identity")
	}
	if !strings.HasSuffix(e.Path, userID) {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, fmt.Errorf("path must end with user uid (%s)", userID)
	}

	b.watchingMu.Lock()
	defer b.watchingMu.Unlock()

	current, ok := b.watching[e.Channel]
	if ok && !current.done.Load() {
		return model.SubscribeReply{
			JoinLeave: false,
			Presence:  false,
			Recover:   false,
		}, backend.SubscribeStreamStatusOK, nil
	}

	// Try to start a watcher for this request
	gvr, name, err := parseWatchRequest(e.Channel, userID)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, err
	}

	// Test this with only provisiong support -- then we can evaluate a broader rollout
	if gvr.Group != provisioning.GROUP {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied,
			fmt.Errorf("watching provisioned resources is OK allowed (for now)")
	}

	// doesn't matter what GetRestConfig sees for context, matters for watch below
	cfg, err := b.configProvider.GetRestConfig(context.Background())
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, err
	}

	// add user to both requester and authInfo context keys, older implementations are still using requester
	ctx := identity.WithRequester(types.WithAuthInfo(context.Background(), u), u)
	uclient, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, err
	}
	client := uclient.Resource(gvr).Namespace(u.GetNamespace())

	opts := v1.ListOptions{}
	if len(name) > 1 {
		opts.FieldSelector = "metadata.name=" + name
	}

	// Support resourceVersion from subscription data.
	if len(e.Data) > 0 {
		var subData struct {
			ResourceVersion string `json:"resourceVersion,omitempty"`
		}
		if err := json.Unmarshal(e.Data, &subData); err == nil && subData.ResourceVersion != "" {
			opts.ResourceVersion = subData.ResourceVersion
		}
	}

	// Re-opens the same watch at a given resourceVersion. The apiserver and the
	// storage backend both end watches on their own schedule, so the watcher
	// needs to be able to resume rather than treating the first close as final.
	newWatch := func(ctx context.Context, resourceVersion string) (watch.Interface, error) {
		resumeOpts := opts
		resumeOpts.ResourceVersion = resourceVersion
		return client.Watch(ctx, resumeOpts)
	}

	watch, err := newWatch(ctx, opts.ResourceVersion)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, err
	}

	current = &watcher{
		ns:        u.GetNamespace(),
		channel:   e.Channel,
		publisher: b.publisher,
		watch:     watch,
		newWatch:  newWatch,
		lastRV:    opts.ResourceVersion,
	}

	b.watching[e.Channel] = current
	go current.run(ctx)

	return model.SubscribeReply{
		JoinLeave: false, // need unsubscribe envents
		Presence:  false,
		Recover:   false,
	}, backend.SubscribeStreamStatusOK, nil
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
	ns        string
	channel   string
	publisher model.ChannelPublisher
	watch     watch.Interface

	// done is set by run on its way out and read by OnSubscribe under a
	// different lock, so it has to carry its own synchronisation.
	done atomic.Bool

	// newWatch re-opens the watch at a resourceVersion; lastRV is the newest one
	// published, so a resumed watch picks up exactly where this one left off.
	newWatch func(ctx context.Context, resourceVersion string) (watch.Interface, error)
	lastRV   string
}

// resumeBackoff is applied between watch resumes so a stream that closes
// immediately and repeatedly cannot spin this loop.
const (
	resumeBackoffMin = 100 * time.Millisecond
	resumeBackoffMax = 5 * time.Second
)

func resourceVersionOf(event watch.Event) string {
	if event.Object == nil {
		return ""
	}
	accessor, err := meta.Accessor(event.Object)
	if err != nil {
		return ""
	}
	return accessor.GetResourceVersion()
}

func (b *watcher) run(ctx context.Context) {
	logger := logging.FromContext(ctx).With("channel", b.channel)

	defer func() {
		b.watch.Stop()
		b.done.Store(true)
	}()

	backoff := resumeBackoffMin
	for {
		ch := b.watch.ResultChan()
		broken := false

		for !broken {
			select {
			// This is sent when there are no longer any subscriptions
			case <-ctx.Done():
				logger.Info("context done", "channel", b.channel)
				return

			// Each watch event
			case event, ok := <-ch:
				if !ok {
					// A closed stream is routine -- the apiserver and the storage
					// backend both end watches on their own schedule. Nothing
					// notifies subscribers when that happens, so returning here
					// leaves the channel silently dead: the socket stays healthy,
					// the client still believes it is subscribed, and no further
					// event ever arrives. Resume instead.
					logger.Info("watch stream broken, resuming", "channel", b.channel, "resourceVersion", b.lastRV)
					broken = true
					continue
				}

				data, err := marshalWatchEvent(event)
				if err != nil {
					logger.Error("marshal error", "channel", b.channel, "err", err)
					continue
				}

				err = b.publisher(b.ns, b.channel, data)
				if err != nil {
					// Publishing is what this watcher exists to do; if that is
					// broken, resuming the watch cannot help.
					logger.Error("publish error", "channel", b.channel, "err", err)
					return
				}

				// Only advance after a successful publish, so a resume replays
				// anything the subscriber has not actually been sent.
				if rv := resourceVersionOf(event); rv != "" {
					b.lastRV = rv
					backoff = resumeBackoffMin
				}
			}
		}

		if b.newWatch == nil {
			return
		}
		b.watch.Stop()

		next, err := b.newWatch(ctx, b.lastRV)
		if err != nil && b.lastRV != "" {
			// Most likely the resourceVersion has aged out of the history window.
			// Start from now instead. Unified storage does not replay existing
			// objects for an unset resourceVersion -- it starts the watch at the
			// current version unless SendInitialEvents is set, see the
			// !SendInitialEvents && Since == 0 branch in
			// pkg/storage/unified/resource/server.go -- so the subscriber keeps
			// whatever it already had and only sees changes from here on: it
			// stays stale for the gap, but the channel is alive and self-heals
			// on the next update rather than going silent for good.
			logger.Warn("watch resume failed, restarting from now",
				"channel", b.channel, "resourceVersion", b.lastRV, "err", err)
			b.lastRV = ""
			next, err = b.newWatch(ctx, "")
		}
		if err != nil {
			logger.Error("watch resume failed", "channel", b.channel, "err", err)
			return
		}
		b.watch = next

		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, resumeBackoffMax)
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
