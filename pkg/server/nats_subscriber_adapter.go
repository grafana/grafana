package server

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// natsEventSubscriber adapts an infra/nats.Subscriber to the storage backend's
// resource.EventSubscriber. An adapter is needed (unlike the publisher, which
// matches structurally) because nats.Subscriber.Subscribe takes a
// nats.MessageHandler and variadic options that the resource-package interface
// deliberately does not expose.
type natsEventSubscriber struct {
	sub nats.Subscriber
}

func (a natsEventSubscriber) Enabled() bool { return a.sub.Enabled() }

func (a natsEventSubscriber) Subscribe(ctx context.Context, subject string, handler func(subject string, data []byte)) (resource.Subscription, error) {
	// No queue group: the shadow notifier wants every message on this instance,
	// not load-balanced delivery across a group.
	return a.sub.Subscribe(ctx, subject, nats.MessageHandler(handler))
}
