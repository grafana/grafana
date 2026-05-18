package resource

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/infra/log"
	infranats "github.com/grafana/grafana/pkg/infra/nats"
)

const (
	natsSubjectPrefix                = "grafana"
	natsUnifiedResourceSubjectPrefix = "unified.resource"
)

type natsNotifier struct {
	clientProvider infranats.ClientProvider
	log            log.Logger
}

func newNATSNotifier(clientProvider infranats.ClientProvider, log log.Logger) *natsNotifier {
	return &natsNotifier{clientProvider: clientProvider, log: log}
}

func (n *natsNotifier) Watch(ctx context.Context, opts WatchOptions) <-chan Event {
	opts = opts.normalize()
	out := make(chan Event, opts.BufferSize)

	nc, err := n.clientProvider.Subscriber(ctx)
	if err != nil {
		n.log.Error("failed to create nats subscriber", "err", err)
		close(out)
		return out
	}

	msgs := make(chan *natsclient.Msg, opts.BufferSize)
	subject := natsSubjectPrefix + "." + natsUnifiedResourceSubjectPrefix + ".>"
	sub, err := nc.ChanSubscribe(subject, msgs)
	if err != nil {
		n.log.Error("failed to subscribe to nats events", "err", err, "subject", subject)
		close(out)
		return out
	}

	go func() {
		defer close(out)
		defer func() {
			if err := sub.Unsubscribe(); err != nil && !errors.Is(err, natsclient.ErrConnectionClosed) {
				n.log.Warn("failed to unsubscribe from nats events", "err", err)
			}
		}()

		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-msgs:
				if msg == nil {
					continue
				}
				var event Event
				if err := json.Unmarshal(msg.Data, &event); err != nil {
					n.log.Warn("failed to decode nats event", "err", err)
					continue
				}
				select {
				case out <- event:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return out
}

func (n *natsNotifier) Publish(event Event) {
	nc, err := n.clientProvider.Publisher(context.Background())
	if err != nil {
		n.log.Warn("failed to create nats publisher", "err", err)
		return
	}

	data, err := json.Marshal(event)
	if err != nil {
		n.log.Warn("failed to encode nats event", "err", err)
		return
	}

	subject := unifiedResourceSubject(event.Namespace, event.Group, event.Resource)
	if err := nc.Publish(subject, data); err != nil {
		n.log.Warn("failed to publish nats event", "err", err, "subject", subject)
		return
	}
	if err := nc.Flush(); err != nil {
		n.log.Warn("failed to flush nats event", "err", err, "subject", subject)
	}
}

func unifiedResourceSubject(namespace, group, resource string) string {
	return strings.Join([]string{
		natsSubjectPrefix,
		natsUnifiedResourceSubjectPrefix,
		sanitizeSubjectToken(namespace),
		sanitizeSubjectToken(group),
		sanitizeSubjectToken(resource),
	}, ".")
}

func sanitizeSubjectToken(value string) string {
	if value == "" {
		return "_"
	}
	replacer := strings.NewReplacer(".", "_", "*", "_", ">", "_", " ", "_")
	return replacer.Replace(value)
}
