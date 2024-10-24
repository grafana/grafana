package resource

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"go.etcd.io/etcd/api/v3/mvccpb"
	clientv3 "go.etcd.io/etcd/client/v3"
	_ "gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/memblob"
)

func NewETCDBackend(ctx context.Context, cfg clientv3.Config) (StorageBackend, error) {
	cli, err := clientv3.New(cfg)
	if err != nil {
		return nil, err
	}

	backend := &etcdBackend{
		client: cli,
	}
	return backend, nil
}

type etcdBackend struct {
	client *clientv3.Client
}

func (s *etcdBackend) WriteEvent(ctx context.Context, event WriteEvent) (rv int64, err error) {
	key := toStringKey(event.Key)
	switch event.Type {
	case WatchEvent_ADDED:
		// TODO, make sure key does not exist?
		r, err := s.client.Put(ctx, key, string(event.Value))
		if err != nil {
			return 0, err
		}
		return r.Header.Revision, err

	case WatchEvent_MODIFIED:
		// TODO, make sure key does exist?
		r, err := s.client.Put(ctx, key, string(event.Value))
		if err != nil {
			return 0, err
		}
		return r.Header.Revision, err

	case WatchEvent_DELETED:
		r, err := s.client.Delete(ctx, key)
		if err != nil {
			return 0, err
		}
		return r.Header.Revision, err

	default:
		return 0, fmt.Errorf("unsupported event")
	}
}

func (s *etcdBackend) ReadResource(ctx context.Context, req *ReadRequest) *ReadResponse {
	rsp := &ReadResponse{}
	key := toStringKey(req.Key)
	got, err := s.client.Get(ctx, key,
		clientv3.WithRev(req.ResourceVersion),
		clientv3.WithLimit(1), // should only have one value for this key
	)
	if err != nil {
		rsp.Error = AsErrorResult(err)
	} else if len(got.Kvs) == 1 {
		val := got.Kvs[0]
		rsp.ResourceVersion = val.ModRevision
		rsp.Value = val.Value
	} else {
		rsp.Error = &ErrorResult{
			Code:    http.StatusInternalServerError,
			Message: "expected one value in response",
		}
	}
	return rsp
}

func (s *etcdBackend) ListIterator(ctx context.Context, req *ListRequest, cb func(ListIterator) error) (int64, error) {

	// ????

	// key := toStringKey(req.Key)

	// got, err := s.client.Get(ctx, key,
	// 	clientv3.WithRev(req.ResourceVersion),
	// 	clientv3.WithLimit(1), // should only have one value for this key
	// )

	// s.client.Get()

	return 0, fmt.Errorf("TODO")
}

func (s *etcdBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	stream := make(chan *WrittenEvent)

	ch := s.client.Watch(ctx, "")
	for wresp := range ch {
		for _, ev := range wresp.Events {
			key, err := keyFromString(string(ev.Kv.Key))
			if err != nil {
				fmt.Printf("ERROR! unexpected key format")
				continue
			}

			evt := WriteEvent{
				Key:   key,
				Value: ev.Kv.Value,
			}
			switch ev.Type {
			case mvccpb.PUT:
				if ev.Kv.CreateRevision == ev.Kv.ModRevision {
					evt.Type = WatchEvent_ADDED
				} else {
					evt.Type = WatchEvent_MODIFIED
				}
			case mvccpb.DELETE:
				evt.Type = WatchEvent_DELETED
			}

			stream <- &WrittenEvent{
				Timestamp:       time.Now().UnixMilli(),
				ResourceVersion: ev.Kv.Version,
				WriteEvent:      evt,
			}
		}
	}

	return stream, nil
}
