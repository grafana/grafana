package informer

import (
	"context"
	"errors"
	"io"
	"sync"
	"time"

	"google.golang.org/protobuf/proto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"

	provinformer "github.com/grafana/grafana/apps/provisioning/pkg/informer"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// errRelist ends a watch so the reflector re-LISTs. The StreamWatcher renders it
// through the Consumer's Gone reporter, which the reflector treats as expired.
var errRelist = errors.New("nats watch: relist interval elapsed")

// decoder adapts a stream of NATS notifications to watch.Decoder so it can back
// a watch.StreamWatcher. Decode blocks until the next event, the relist timer
// fires, or the watch is closed/cancelled.
type decoder struct {
	ctx    context.Context
	cancel context.CancelFunc
	msgs   <-chan notification
	sub    nats.Subscription
	get    provinformer.GetFunc
	log    log.Logger
	timer  *time.Timer

	closeOnce sync.Once
}

// Decode returns the next watch event. Each notification is a metadata-only
// WatchNotification, so the decoder fetches the current object with Get and
// delivers that. It skips notifications it cannot turn into a faithful event —
// malformed, unknown verb, or an object that has already vanished — rather than
// tearing the watch down, since one bad notification must not stop delivery of
// the rest.
//
// When the relist timer fires it returns errRelist, which the StreamWatcher
// surfaces as a Gone error so the reflector re-LISTs (the only thing that
// reconciles hard deletes and other gaps). A cancelled context ends the stream
// with io.EOF, which the reflector treats as a normal watch close.
func (d *decoder) Decode() (watch.EventType, runtime.Object, error) {
	for {
		var msg notification
		select {
		case <-d.ctx.Done():
			return watch.Error, nil, io.EOF
		case <-d.timer.C:
			return watch.Error, nil, errRelist
		case m, ok := <-d.msgs:
			if !ok {
				return watch.Error, nil, io.EOF
			}
			msg = m
		}

		var evt resourcepb.WatchNotification
		if err := proto.Unmarshal(msg.data, &evt); err != nil {
			d.log.Warn("dropping malformed nats notification", "subject", msg.subject, "error", err)
			continue
		}

		switch evt.Type {
		case resourcepb.WatchNotification_ADDED, resourcepb.WatchNotification_MODIFIED, resourcepb.WatchNotification_DELETED:
		default:
			d.log.Warn("dropping nats notification with unknown type", "subject", msg.subject, "type", evt.Type)
			continue
		}

		obj, err := d.get(d.ctx, evt.Name, metav1.GetOptions{})
		switch {
		case apierrors.IsNotFound(err):
			// The object is gone. We deliberately do not synthesize a delete:
			// the notification has no finalizers/spec/metadata, so any object we
			// built would be unfaithful. Removal is left to the periodic relist
			// (see the timer above), where the reflector emits the delete from
			// its own last-known cached copy.
			d.log.Debug("nats notification for missing object; deferring removal to relist", "name", evt.Name)
			continue
		case err != nil:
			d.log.Warn("dropping nats notification; get failed", "name", evt.Name, "error", err)
			continue
		}

		// The object exists, so deliver its current state. ADDED maps to Added;
		// everything else (MODIFIED, or a DELETED whose object is still present
		// mid-finalization or after a recreate) is delivered as Modified —
		// delivering a delete would evict a live object from the cache.
		action := watch.Modified
		if evt.Type == resourcepb.WatchNotification_ADDED {
			action = watch.Added
		}
		return action, obj, nil
	}
}

// Close stops the relist timer, cancels any in-flight Get, and unsubscribes from
// NATS. The StreamWatcher calls it when the watch stops; it is safe to call more
// than once.
func (d *decoder) Close() {
	d.closeOnce.Do(func() {
		d.cancel()
		d.timer.Stop()
		if err := d.sub.Unsubscribe(); err != nil {
			d.log.Debug("nats watch unsubscribe", "error", err)
		}
	})
}

var _ watch.Decoder = (*decoder)(nil)
