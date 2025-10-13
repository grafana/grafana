package apistore

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sync"

	grpcCodes "google.golang.org/grpc/codes"
	grpcStatus "google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type streamDecoder struct {
	client      resource.ResourceStore_WatchClient
	newFunc     func() runtime.Object
	predicate   storage.SelectionPredicate
	codec       runtime.Codec
	cancelWatch context.CancelFunc
	done        sync.WaitGroup
}

func newStreamDecoder(client resource.ResourceStore_WatchClient, newFunc func() runtime.Object, predicate storage.SelectionPredicate, codec runtime.Codec, cancelWatch context.CancelFunc) *streamDecoder {
	return &streamDecoder{
		client:      client,
		newFunc:     newFunc,
		predicate:   predicate,
		codec:       codec,
		cancelWatch: cancelWatch,
	}
}
func (d *streamDecoder) toObject(w *resource.WatchEvent_Resource) (runtime.Object, error) {
	var obj runtime.Object
	var err error
	obj, _, err = d.codec.Decode(w.Value, nil, d.newFunc())
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
decode:
	for {
		var evt *resource.WatchEvent
		var err error
		select {
		case <-d.client.Context().Done():
		default:
			evt, err = d.client.Recv()
		}

		switch {
		case errors.Is(d.client.Context().Err(), context.Canceled):
			return watch.Error, nil, io.EOF
		case d.client.Context().Err() != nil:
			return watch.Error, nil, d.client.Context().Err()
		case errors.Is(err, io.EOF):
			return watch.Error, nil, io.EOF
		case grpcStatus.Code(err) == grpcCodes.Canceled:
			return watch.Error, nil, err
		case err != nil:
			klog.Errorf("client: error receiving result: %s", err)
			return watch.Error, nil, err
		}

		// Error event
		if evt.Type == resource.WatchEvent_ERROR {
			err = fmt.Errorf("stream error")
			klog.Errorf("client: error receiving result: %s", err)
			return watch.Error, nil, err
		}

		if evt.Resource == nil {
			klog.Errorf("client: received nil \n")
			continue decode
		}

		if evt.Type == resource.WatchEvent_BOOKMARK {
			obj := d.newFunc()

			// here k8s expects an empty object with just resource version and k8s.io/initial-events-end annotation
			accessor, err := utils.MetaAccessor(obj)
			if err != nil {
				klog.Errorf("error getting object accessor: %s", err)
				return watch.Error, nil, err
			}

			accessor.SetResourceVersionInt64(evt.Resource.Version)
			accessor.SetAnnotations(map[string]string{"k8s.io/initial-events-end": "true"})
			return watch.Bookmark, obj, nil
		}

		obj, err := d.toObject(evt.Resource)
		if err != nil {
			klog.Errorf("error decoding entity: %s", err)
			return watch.Error, nil, err
		}

		var watchAction watch.EventType
		switch evt.Type {
		case resource.WatchEvent_ADDED:
			// apply any predicates not handled in storage
			matches, err := d.predicate.Matches(obj)
			if err != nil {
				klog.Errorf("error matching object: %s", err)
				return watch.Error, nil, err
			}
			if !matches {
				continue decode
			}

			watchAction = watch.Added
		case resource.WatchEvent_MODIFIED:
			watchAction = watch.Modified

			// apply any predicates not handled in storage
			matches, err := d.predicate.Matches(obj)
			if err != nil {
				klog.Errorf("error matching object: %s", err)
				return watch.Error, nil, err
			}

			// if we have a previous object, check if it matches
			prevMatches := false
			var prevObj runtime.Object
			if evt.Previous != nil {
				prevObj, err = d.toObject(evt.Previous)
				if err != nil {
					klog.Errorf("error decoding entity: %s", err)
					return watch.Error, nil, err
				}

				// apply any predicates not handled in storage
				prevMatches, err = d.predicate.Matches(prevObj)
				if err != nil {
					klog.Errorf("error matching object: %s", err)
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
					klog.Errorf("error getting object accessor: %s", err)
					return watch.Error, nil, err
				}

				accessor.SetResourceVersionInt64(evt.Resource.Version)
			} else if !prevMatches {
				// if the object didn't previously match, send an Added event
				watchAction = watch.Added
			}
		case resource.WatchEvent_DELETED:
			watchAction = watch.Deleted

			// if we have a previous object, return that in the deleted event
			if evt.Previous != nil {
				obj, err = d.toObject(evt.Previous)
				if err != nil {
					klog.Errorf("error decoding entity: %s", err)
					return watch.Error, nil, err
				}

				// here k8s expects the previous object but with the new resource version
				accessor, err := utils.MetaAccessor(obj)
				if err != nil {
					klog.Errorf("error getting object accessor: %s", err)
					return watch.Error, nil, err
				}

				accessor.SetResourceVersionInt64(evt.Resource.Version)
			}

			// apply any predicates not handled in storage
			matches, err := d.predicate.Matches(obj)
			if err != nil {
				klog.Errorf("error matching object: %s", err)
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
		klog.Errorf("error closing watch stream: %s", err)
	}
	// Cancel the send context
	d.cancelWatch()
	// Wait for all decode operations to finish
	d.done.Wait()
}

var _ watch.Decoder = (*streamDecoder)(nil)
