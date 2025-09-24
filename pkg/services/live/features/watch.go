package features

import (
	"context"
	"fmt"
	"strings"
	"sync"

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
func (b *WatchRunner) OnSubscribe(ctx context.Context, u identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	// To make sure we do not share resources across users, in clude the UID in the path
	userID := u.GetIdentifier()
	if userID == "" {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, fmt.Errorf("missing user identity")
	}
	if !strings.HasSuffix(e.Path, userID) {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, fmt.Errorf("path must end with user uid (%s)", userID)
	}

	// While testing with provisioning repositories, we will limit this to admin only
	if !u.HasRole(identity.RoleAdmin) {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, fmt.Errorf("only admin users for now")
	}

	b.watchingMu.Lock()
	defer b.watchingMu.Unlock()

	current, ok := b.watching[e.Channel]
	if ok && !current.done {
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

	requester := types.WithAuthInfo(context.Background(), u)
	cfg, err := b.configProvider.GetRestConfig(requester)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, err
	}
	uclient, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, err
	}
	client := uclient.Resource(gvr).Namespace(u.GetNamespace())

	opts := v1.ListOptions{}
	if len(name) > 1 {
		opts.FieldSelector = "metadata.name=" + name
	}
	watch, err := client.Watch(requester, opts)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, err
	}

	current = &watcher{
		orgId:     u.GetOrgID(),
		channel:   e.Channel,
		publisher: b.publisher,
		watch:     watch,
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
	orgId     int64
	channel   string
	publisher model.ChannelPublisher
	done      bool
	watch     watch.Interface
}

func (b *watcher) run(ctx context.Context) {
	logger := logging.FromContext(ctx).With("channel", b.channel)

	ch := b.watch.ResultChan()
	for {
		select {
		// This is sent when there are no longer any subscriptions
		case <-ctx.Done():
			logger.Info("context done", "channel", b.channel)
			b.watch.Stop()
			b.done = true
			return

		// Each watch event
		case event, ok := <-ch:
			if !ok {
				logger.Info("watch stream broken", "channel", b.channel)
				b.watch.Stop()
				b.done = true // will force reconnect from the frontend
				return
			}

			cfg := jsoniter.ConfigCompatibleWithStandardLibrary
			stream := cfg.BorrowStream(nil)
			defer cfg.ReturnStream(stream)

			// regular json.Marshal() uses upper case
			stream.WriteObjectStart()
			stream.WriteObjectField("type")
			stream.WriteString(string(event.Type))
			stream.WriteMore()
			stream.WriteObjectField("object")
			stream.WriteVal(event.Object)
			stream.WriteObjectEnd()

			buf := stream.Buffer()
			data := make([]byte, len(buf))
			copy(data, buf)

			err := b.publisher(b.orgId, b.channel, data)
			if err != nil {
				logger.Error("publish error", "channel", b.channel, "err", err)
				b.watch.Stop()
				b.done = true // will force reconnect from the frontend
				continue
			}
		}
	}
}
