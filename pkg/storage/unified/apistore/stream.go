package apistore

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sync"

	grpcCodes "google.golang.org/grpc/codes"
	grpcStatus "google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type streamDecoder struct {
	client      resourcepb.ResourceStore_WatchClient
	newFunc     func() runtime.Object
	predicate   storage.SelectionPredicate
	serializer  Serializer
	cancelWatch context.CancelFunc
	done        sync.WaitGroup

	sendInitialEvents   bool
	initialBookmarkSent bool
	expiredSent         bool
}

func newStreamDecoder(client resourcepb.ResourceStore_WatchClient, newFunc func() runtime.Object, predicate storage.SelectionPredicate, serializer Serializer, cancelWatch context.CancelFunc, sendInitialEvents bool) *streamDecoder {
	return &streamDecoder{
		client:            client,
		newFunc:           newFunc,
		predicate:         predicate,
		serializer:        serializer,
		cancelWatch:       cancelWatch,
		sendInitialEvents: sendInitialEvents,
	}
}
func (d *streamDecoder) toObject(w *resourcepb.WatchEvent_Resource) (runtime.Object, error) {
	obj, err := d.serializer.Decode(d.client.Context(), w.Value, d.newFunc())
	if err == nil {
		accessor, err := utils.MetaAccessor(obj)
		if err != nil {
			return nil, err
		}
		accessor.SetResourceVersionInt64(w.Version)
	}
	return obj, err
}

// nolint: gocyclo // we may be able to simplify this in the future, but this is a complex function by nature
func (d *streamDecoder) Decode() (action watch.EventType, object runtime.Object, err error) {
	d.done.Add(1)
	defer d.done.Done()
	logger := logging.FromContext(d.client.Context())
decode:
	for {
		// Read the terminal status even if the stream context is already canceled.
		evt, err := d.client.Recv()

		switch {
		case resource.IsResourceVersionExpired(err):
			// Surface a 410/Expired status object (instead of an error) so clients
			// such as reflectors re-list from scratch rather than retrying the
			// watch from a resource version the server can no longer serve.
			if d.expiredSent {
				return watch.Error, nil, io.EOF
			}
			d.expiredSent = true
			logger.Debug("client: watch resource version expired", "error", err)
			status := resource.AsErrorResult(err)
			return watch.Error, &metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    status.Code,
				Reason:  metav1.StatusReason(status.Reason),
				Message: status.Message,
			}, nil
		case errors.Is(d.client.Context().Err(), context.Canceled):
			// gRPC also cancels the context on transport disconnects. Treat these
			// as EOF so watches can resume without a full re-list.
			return watch.Error, nil, io.EOF
		case d.client.Context().Err() != nil:
			return watch.Error, nil, d.client.Context().Err()
		case errors.Is(err, io.EOF):
			return watch.Error, nil, io.EOF
		case grpcStatus.Code(err) == grpcCodes.Canceled:
			return watch.Error, nil, err
		case err != nil:
			logger.Error("client: error receiving result", "error", err)
			return watch.Error, nil, err
		}

		// Error event
		if evt.Type == resourcepb.WatchEvent_ERROR {
			err = fmt.Errorf("stream error")
			logger.Error("client: error receiving result", "error", err)
			return watch.Error, nil, err
		}

		if evt.Resource == nil {
			logger.Error("client: received nil resource")
			continue decode
		}

		if evt.Type == resourcepb.WatchEvent_BOOKMARK {
			obj := d.newFunc()

			accessor, err := utils.MetaAccessor(obj)
			if err != nil {
				logger.Error("error getting object accessor", "error", err)
				return watch.Error, nil, err
			}

			accessor.SetResourceVersionInt64(evt.Resource.Version)
			if d.sendInitialEvents && !d.initialBookmarkSent {
				accessor.SetAnnotations(map[string]string{"k8s.io/initial-events-end": "true"})
				d.initialBookmarkSent = true
			}
			return watch.Bookmark, obj, nil
		}

		// Deletes may carry an empty value with the deleted object in Previous.
		decodeSource := evt.Resource
		if evt.Type == resourcepb.WatchEvent_DELETED && evt.Previous != nil {
			decodeSource = evt.Previous
		}
		obj, err := d.toObject(decodeSource)
		if err != nil {
			logger.Error("error decoding entity", "error", err)
			return watch.Error, nil, err
		}

		var watchAction watch.EventType
		switch evt.Type {
		case resourcepb.WatchEvent_ADDED:
			// apply any predicates not handled in storage
			matches, err := d.predicate.Matches(obj)
			if err != nil {
				logger.Error("error matching object", "error", err)
				return watch.Error, nil, err
			}
			if !matches {
				continue decode
			}

			watchAction = watch.Added
		case resourcepb.WatchEvent_MODIFIED:
			watchAction = watch.Modified

			// apply any predicates not handled in storage
			matches, err := d.predicate.Matches(obj)
			if err != nil {
				logger.Error("error matching object", "error", err)
				return watch.Error, nil, err
			}

			// if we have a previous object, check if it matches
			prevMatches := false
			var prevObj runtime.Object
			if evt.Previous != nil {
				prevObj, err = d.toObject(evt.Previous)
				if err != nil {
					logger.Error("error decoding entity", "error", err)
					return watch.Error, nil, err
				}

				// apply any predicates not handled in storage
				prevMatches, err = d.predicate.Matches(prevObj)
				if err != nil {
					logger.Error("error matching object", "error", err)
					return watch.Error, nil, err
				}
			}

			if !matches {
				if !prevMatches {
					continue decode
				}

				// if the object didn't match, send a Deleted event
				watchAction = watch.Deleted

				// here k8s expects the previous object but with the new resource version
				obj = prevObj

				accessor, err := utils.MetaAccessor(obj)
				if err != nil {
					logger.Error("error getting object accessor", "error", err)
					return watch.Error, nil, err
				}

				accessor.SetResourceVersionInt64(evt.Resource.Version)
			} else if !prevMatches {
				// if the object didn't previously match, send an Added event
				watchAction = watch.Added
			}
		case resourcepb.WatchEvent_DELETED:
			watchAction = watch.Deleted

			if evt.Previous != nil {
				// Watch clients must resume from the deletion's version, not the previous object's.
				accessor, err := utils.MetaAccessor(obj)
				if err != nil {
					logger.Error("error getting object accessor", "error", err)
					return watch.Error, nil, err
				}
				accessor.SetResourceVersionInt64(evt.Resource.Version)
			}

			// apply any predicates not handled in storage
			matches, err := d.predicate.Matches(obj)
			if err != nil {
				logger.Error("error matching object", "error", err)
				return watch.Error, nil, err
			}
			if !matches {
				continue decode
			}
		default:
			watchAction = watch.Error
		}

		return watchAction, obj, nil
	}
}

func (d *streamDecoder) Close() {
	// Close the send stream
	err := d.client.CloseSend()
	if err != nil {
		logging.FromContext(d.client.Context()).Error("error closing watch stream", "error", err)
	}
	// Cancel the send context
	d.cancelWatch()
	// Wait for all decode operations to finish
	d.done.Wait()
}

var _ watch.Decoder = (*streamDecoder)(nil)
