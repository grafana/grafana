// Package natsbus adapts the NATS subscriber to the app-sdk's resourcebus contract, so that an app can take its
// informer deltas from the change notifications unified storage publishes.
//
// It sits with the subject layout and the wire format it decodes, and it is the only package an adopter needs on the
// NATS side: the adapter is built in the wiring and handed to an app as a resourcebus.Subscriber, so no app package
// imports pkg/infra/nats.
package natsbus

import (
	"context"
	"strconv"

	"github.com/grafana/grafana-app-sdk/resourcebus"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// verbs maps the notification types the bus carries onto the contract's verbs. A type absent from it — UNKNOWN, or
// one this binary predates — is dropped rather than guessed at.
var verbs = map[resourcepb.WatchNotification_Type]resourcebus.Verb{
	resourcepb.WatchNotification_ADDED:    resourcebus.VerbAdded,
	resourcepb.WatchNotification_MODIFIED: resourcebus.VerbModified,
	resourcepb.WatchNotification_DELETED:  resourcebus.VerbDeleted,
}

// New returns a resourcebus.Subscriber backed by sub, or nil when NATS is not enabled for it.
//
// The nil is untyped on purpose: the SDK selects the kubernetes watch on a nil Subscriber through an interface
// comparison, which a non-nil interface holding a nil *subscriber would pass.
func New(sub nats.Subscriber, logger log.Logger) resourcebus.Subscriber {
	if !nats.Enabled(sub) {
		return nil
	}
	return &subscriber{sub: sub, log: logger}
}

type subscriber struct {
	sub nats.Subscriber
	log log.Logger
}

var _ resourcebus.Subscriber = (*subscriber)(nil)

func (s *subscriber) Subscribe(ctx context.Context, gvr schema.GroupVersionResource, namespace string,
	handler func(context.Context, resourcebus.Event), opts ...resourcebus.SubscribeOption) (resourcebus.Subscription, error) {
	cfg := resourcebus.NewSubscribeConfig(opts...)
	natsOpts := make([]nats.SubscribeOption, 0, 2)
	if cfg.SharedGroup != "" {
		natsOpts = append(natsOpts, nats.WithQueueGroup(cfg.SharedGroup))
	}
	if cfg.OnReconnect != nil {
		natsOpts = append(natsOpts, nats.WithOnReconnect(cfg.OnReconnect))
	}

	subject := resourcewatch.Subject(gvr, namespace)
	sub, err := s.sub.Subscribe(ctx, subject, s.onMessage(ctx, handler), natsOpts...)
	if err != nil {
		return nil, err
	}
	s.log.Debug("subscribed to resource change notifications", "subject", subject, "gvr", gvr.String())
	return subscription{sub}, nil
}

// onMessage decodes a change notification into a bus event. A malformed envelope or a type this adapter does not map
// is logged and dropped, so that one bad message cannot stop delivery of the rest.
func (s *subscriber) onMessage(ctx context.Context, handler func(context.Context, resourcebus.Event)) nats.MessageHandler {
	return func(subject string, data []byte) {
		var notification resourcepb.WatchNotification
		if err := proto.Unmarshal(data, &notification); err != nil {
			s.log.Warn("dropping malformed nats notification", "subject", subject, "error", err)
			return
		}
		verb, ok := verbs[notification.Type]
		if !ok {
			s.log.Warn("dropping nats notification with unknown type", "subject", subject, "type", notification.Type)
			return
		}
		handler(ctx, resourcebus.Event{
			Verb:      verb,
			Namespace: notification.Namespace,
			Name:      notification.Name,
			// Unified storage issues a monotonic int64; the contract carries the opaque string the kubernetes API
			// guarantees, so this is the one place a version crosses between the two.
			ResourceVersion: strconv.FormatInt(notification.ResourceVersion, 10),
		})
	}
}

// subscription maps the contract's Close onto the NATS subscriber's Unsubscribe; WaitReady is the same method on both.
type subscription struct {
	nats.Subscription
}

var _ resourcebus.Subscription = subscription{}

func (s subscription) Close() error { return s.Unsubscribe() }

// ProvideSubscriber builds the adapter for dependency injection, so that an app receives the bus as a
// resourcebus.Subscriber and no app package imports pkg/infra/nats. An app runs on the bus wherever NATS is enabled,
// as the provisioning controllers already do; with it off the nil selects the kubernetes watch.
func ProvideSubscriber(sub nats.Subscriber) resourcebus.Subscriber {
	return New(sub, log.New("resourcebus.nats"))
}
