package informer

import (
	"context"
	"fmt"
	"net/http"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"

	provinformer "github.com/grafana/grafana/apps/provisioning/pkg/informer"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// notification is a raw message bridged from the NATS subscriber to the decoder.
type notification struct {
	subject string
	data    []byte
}

// watchChanBuffer bounds how many notifications can queue per watch before the
// NATS subscriber drops the slowest. The informer's event handler drains
// promptly, so a small buffer absorbs bursts without unbounded memory growth.
const watchChanBuffer = 256

// queueGroup makes every replica's subscription join one NATS queue group, so
// the broker round-robins each notification to a single replica instead of
// broadcasting to all. A given replica therefore observes only a subset of the
// events, which is why the periodic re-LIST (see relistInterval) — not the live
// stream — is what keeps each replica's cache complete.
const queueGroup = "provisioning-informer"

// defaultRelistInterval is the fallback re-LIST cadence when a caller does not
// specify one; normally the informer's resync interval is used.
const defaultRelistInterval = 5 * time.Minute

// Consumer is a prototype NATS-based watch transport for the provisioning
// informers. It plugs into the watch-swap seam in this package: Watch subscribes
// to the per-resource NATS subject defined by the resourcewatch contract and
// turns each notification into a watch event, so the informers' delta source
// comes from NATS while their caches keep being seeded by the apiserver LIST.
//
// NATS carries only metadata (a resourcepb.WatchNotification), so the Consumer
// materializes every notification by issuing a GET at the informer's own
// version — this is what makes the transport version-agnostic and keeps the
// object faithful (full metadata, finalizers, spec). A notification whose object
// can no longer be fetched is dropped rather than fabricated.
//
// Delivery is round-robin across replicas (a NATS queue group): each replica
// sees only the events routed to it, and hard deletes are never delivered at
// all. The live stream is therefore only a low-latency hint — correctness comes
// from ending each watch with a Gone error every relistInterval, which makes the
// reflector re-LIST the full set from the API and reconcile every replica's
// cache against a fresh snapshot.
type Consumer struct {
	subscriber     nats.Subscriber
	log            log.Logger
	relistInterval time.Duration
}

// NewConsumer builds a Consumer over the shared NATS subscriber. relistInterval
// is how often each watch re-LISTs from the API (pass the informer's resync
// interval); a non-positive value falls back to defaultRelistInterval. The
// subscriber owns the connection lifecycle; the Consumer only opens per-watch
// subscriptions through it.
func NewConsumer(subscriber nats.Subscriber, relistInterval time.Duration) *Consumer {
	if relistInterval <= 0 {
		relistInterval = defaultRelistInterval
	}
	return &Consumer{
		subscriber:     subscriber,
		log:            log.New("provisioning.informer.nats"),
		relistInterval: relistInterval,
	}
}

// Watch implements WatchFunc. It subscribes to the resource's NATS subject and
// returns a watch.Interface that materializes each metadata notification into a
// watch event by fetching the current object with get. The watch ends itself
// with a Gone error after relistInterval so the reflector re-LISTs. opts is
// ignored — NATS carries only live notifications, so there is no resourceVersion
// to resume from.
func (c *Consumer) Watch(ctx context.Context, gvr schema.GroupVersionResource, namespace string, get provinformer.GetFunc, _ metav1.ListOptions) (watch.Interface, error) {
	if get == nil {
		return nil, fmt.Errorf("nats consumer: missing Get for %s", gvr.String())
	}

	subject := resourcewatch.Subject(gvr, namespace)
	watchCtx, cancel := context.WithCancel(ctx)

	// The subscriber invokes handler on its own delivery goroutine. Hand each
	// raw notification to the decoder over a buffered channel; if the decoder is
	// not draining fast enough, drop rather than block delivery for other watches
	// — the periodic relist heals the gap. The data slice is owned by the
	// subscriber once handler returns, so copy it before queueing.
	msgs := make(chan notification, watchChanBuffer)
	handler := func(subject string, data []byte) {
		buf := make([]byte, len(data))
		copy(buf, data)
		select {
		case msgs <- notification{subject: subject, data: buf}:
		case <-watchCtx.Done():
		default:
			c.log.Warn("dropping nats notification; watch buffer full", "subject", subject)
		}
	}

	sub, err := c.subscriber.Subscribe(watchCtx, subject, handler, nats.WithQueueGroup(queueGroup))
	if err != nil {
		cancel()
		return nil, fmt.Errorf("nats consumer: subscribe %q: %w", subject, err)
	}
	c.log.Debug("opened nats watch", "subject", subject, "gvr", gvr.String())

	decoder := &decoder{
		ctx:    watchCtx,
		cancel: cancel,
		msgs:   msgs,
		sub:    sub,
		get:    get,
		log:    c.log,
		timer:  time.NewTimer(c.relistInterval),
	}
	// A Gone (410) status makes the reflector treat the watch as expired and
	// re-LIST, rather than merely reconnecting it.
	reporter := apierrors.NewClientErrorReporter(http.StatusGone, "WATCH", "Expired")
	return watch.NewStreamWatcher(decoder, reporter), nil
}
