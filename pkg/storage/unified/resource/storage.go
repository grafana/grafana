package resource

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

var _ StorageBackend = (*versionedStorage)(nil)

// versionedStorage is able to store and retrieve versioned objects.
// V0 : Raw object
// V1 : StoredValue - protobuf encoded object with additional metadata
type versionedStorage struct {
	backend StorageBackend
}

func NewVersionedStorage(backend StorageBackend) StorageBackend {
	return &versionedStorage{
		backend: backend,
	}
}

func (s *versionedStorage) WriteEvent(ctx context.Context, e WriteEvent) (int64, error) {
	v, err := proto.Marshal(&StoredValue{
		Raw:       e.Value,
		Namespace: e.Key.Namespace,
		Group:     e.Key.Group,
		Resource:  e.Key.Resource,
		Name:      e.Key.Name,
		Folder:    e.Object.GetFolder(),
	})
	if err != nil {
		return 0, err
	}
	e.Value = v
	return s.backend.WriteEvent(ctx, e)

}

// TODO: For new this returns the raw object, but we should return the StoredValue with Metadata
func (s *versionedStorage) ReadResource(ctx context.Context, r *ReadRequest) *ReadResponse {
	rsp := s.backend.ReadResource(ctx, r)
	if rsp.Error != nil {
		return rsp
	}

	v, err := unmarshalStoredValue(rsp.Value)
	if err != nil {
		fmt.Println(err)
		rsp.Value = nil // no partial result
		rsp.Error = AsErrorResult(err)
		return rsp
	}
	rsp.Value = v.Raw
	return rsp
}

type listIter struct {
	backend ListIterator
}

func (l *listIter) ContinueToken() string {
	return l.backend.ContinueToken()
}

func (l *listIter) Error() error {
	return l.backend.Error()
}

func (l *listIter) Name() string {
	return l.backend.Name()
}

func (l *listIter) Namespace() string {
	return l.backend.Namespace()
}

func (l *listIter) ResourceVersion() int64 {
	return l.backend.ResourceVersion()
}

func (l *listIter) Value() []byte {
	v, err := unmarshalStoredValue(l.backend.Value())
	if err != nil {
		// TODO: Log error
		return nil
	}
	return v.Raw
}

func (l *listIter) Next() bool {
	return l.backend.Next()
}

var _ ListIterator = (*listIter)(nil)

func (s *versionedStorage) ListIterator(ctx context.Context, r *ListRequest, cb func(ListIterator) error) (int64, error) {
	return s.backend.ListIterator(ctx, r, func(iter ListIterator) error {
		return cb(&listIter{backend: iter})
	})
}

func (s *versionedStorage) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	ch, err := s.backend.WatchWriteEvents(ctx)
	if err != nil {
		return nil, err
	}
	out := make(chan *WrittenEvent)
	go func() {
		defer close(out)
		for e := range ch {
			v, err := unmarshalStoredValue(e.Value)
			if err != nil {
				// TODO: Log critical error
				fmt.Println(err)
				continue
			}
			e.Value = v.Raw
			out <- e
		}
	}()
	return out, nil
}

func unmarshalStoredValue(v []byte) (*StoredValue, error) {
	var val StoredValue
	if err := proto.Unmarshal(v, &val); err != nil {
		// Probably not a protobuf value, let's try to unmarshal it as a raw object
		tmp := &unstructured.Unstructured{}
		if err := tmp.UnmarshalJSON(v); err != nil {
			return nil, err
		}
		obj, err := utils.MetaAccessor(tmp)
		if err != nil {
			return nil, err
		}
		val.Group = obj.GetGroupVersionKind().Group
		val.Resource = obj.GetGroupVersionKind().Kind
		val.Namespace = obj.GetNamespace()
		val.Name = obj.GetName()
		val.Folder = obj.GetFolder()
		val.Raw = v
	}
	return &val, nil
}
