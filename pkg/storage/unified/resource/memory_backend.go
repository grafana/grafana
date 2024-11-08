package resource

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func NewMemoryBackend() (StorageBackend, error) {
	backend := &memoryBackend{
		tree: make(map[string]*memoryResource),
	}
	backend.rv.Swap(time.Now().UnixMilli())
	return backend, nil
}

type memoryBackend struct {
	mutex sync.Mutex
	rv    atomic.Int64
	tree  map[string]*memoryResource

	// Simple watch stream -- NOTE, this only works for single tenant!
	broadcaster Broadcaster[*WrittenEvent]
	stream      chan<- *WrittenEvent
}

func (s *memoryBackend) Namespaces(ctx context.Context) ([]string, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *memoryBackend) WriteEvent(ctx context.Context, event WriteEvent) (rv int64, err error) {
	rv = s.rv.Add(1)

	// Scope the lock
	{
		s.mutex.Lock()
		defer s.mutex.Unlock()

		tree := s.getResourceTree(event.Key)
		value := &memoryValue{
			rv:     rv,
			ns:     event.Key.Namespace,
			name:   event.Key.Name,
			folder: event.Object.GetFolder(),
			value:  event.Value,
		}

		switch event.Type {
		case WatchEvent_ADDED:
			val := tree.get(event.Key, 0)
			if val != nil && !val.deleted {
				return 0, fmt.Errorf("key already exists")
			}
			err = tree.add(event.Key, value)

		case WatchEvent_MODIFIED:
			err = tree.add(event.Key, value)

		case WatchEvent_DELETED:
			current := tree.get(event.Key, 0) // the latest
			if current == nil || current.deleted {
				return 0, fmt.Errorf("not found")
			}
			value.deleted = true
			err = tree.add(event.Key, value)

		// ignore
		default:
			return rv, nil //
		}
	}

	// Async notify all subscribers
	if s.stream != nil {
		go func() {
			write := &WrittenEvent{
				WriteEvent:      event,
				Timestamp:       time.Now().UnixMilli(),
				ResourceVersion: rv,
			}
			s.stream <- write
		}()
	}
	return rv, err
}

func (s *memoryBackend) ReadResource(ctx context.Context, req *ReadRequest) *ReadResponse {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	tree := s.getResourceTree(req.Key)
	val := tree.get(req.Key, req.ResourceVersion)
	if val == nil {
		return &ReadResponse{Error: NewNotFoundError(req.Key)}
	}
	if req.ResourceVersion > 0 {
		if req.ResourceVersion > s.rv.Load() {
			return &ReadResponse{
				Error: &ErrorResult{
					Code:    http.StatusGatewayTimeout,
					Reason:  string(metav1.StatusReasonTimeout), // match etcd behavior
					Message: "ResourceVersion is larger than max",
					Details: &ErrorDetails{
						Causes: []*ErrorCause{
							{
								Reason:  string(metav1.CauseTypeResourceVersionTooLarge),
								Message: fmt.Sprintf("requested: %d, current %d", req.ResourceVersion, s.rv.Load()),
							},
						},
					},
				},
			}
		}
	}

	return &ReadResponse{
		ResourceVersion: val.rv,
		Value:           val.value,
	}
}

func (s *memoryBackend) ListIterator(ctx context.Context, req *ListRequest, cb func(ListIterator) error) (int64, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	key := req.Options.Key
	tree := s.getResourceTree(key)
	iter := &memoryListIterator{
		index: -1,
		rv:    req.ResourceVersion,
	}
	if iter.rv == 0 {
		iter.rv = s.rv.Load()
	}
	if req.NextPageToken != "" {
		idx, err := strconv.Atoi(req.NextPageToken)
		if err != nil {
			return 0, fmt.Errorf("invalid next token")
		}
		iter.index = idx
	}

	if key.Namespace == "" {
		for _, ns := range tree.namespaces {
			iter.add(ns)
		}
	} else {
		ns, ok := tree.namespaces[key.Namespace]
		if ok {
			iter.add(ns)
		}
	}

	// sort?
	return iter.rv, cb(iter)
}

func (s *memoryBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.broadcaster == nil {
		var err error
		s.broadcaster, err = NewBroadcaster(context.Background(), func(c chan<- *WrittenEvent) error {
			s.stream = c
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	return s.broadcaster.Subscribe(ctx)
}

// This must be called inside a locked mutex
func (s *memoryBackend) getResourceTree(key *ResourceKey) *memoryResource {
	prefix := fmt.Sprintf("%s/%s", key.Group, key.Resource)
	tree, ok := s.tree[prefix]
	if !ok {
		tree = &memoryResource{
			group:      key.Group,
			resource:   key.Resource,
			namespaces: make(map[string]*memoryNamespace),
		}
		s.tree[prefix] = tree
	}
	return tree
}

// Only the latest version of each
// group > resource > namespace > name > versions
type memoryResource struct {
	group    string
	resource string

	namespaces map[string]*memoryNamespace
}

func (v *memoryResource) get(key *ResourceKey, rv int64) *memoryValue {
	ns, ok := v.namespaces[key.Namespace]
	if ok {
		return ns.get(key, rv)
	}
	return nil
}

func (v *memoryResource) add(key *ResourceKey, val *memoryValue) error {
	ns, ok := v.namespaces[key.Namespace]
	if !ok {
		ns = &memoryNamespace{
			names: make(map[string]*memoryValues),
		}
		v.namespaces[key.Namespace] = ns
	}
	return ns.add(key, val)
}

type memoryNamespace struct {
	names map[string]*memoryValues
}

func (v *memoryNamespace) get(key *ResourceKey, rv int64) *memoryValue {
	vv, ok := v.names[key.Name]
	if ok {
		return vv.get(rv)
	}
	return nil
}

func (v *memoryNamespace) add(key *ResourceKey, val *memoryValue) error {
	vals, ok := v.names[key.Name]
	if !ok {
		vals = &memoryValues{
			version: []*memoryValue{val},
		}
		v.names[key.Name] = vals
		return nil
	}

	current := vals.get(0)
	if current != nil && current.rv > val.rv {
		return fmt.Errorf("addign an RV with lower value")
	}

	vals.version = append(vals.version, val)
	return nil
}

type memoryValues struct {
	version []*memoryValue
}

// Get the closest (but not greater than)
func (v *memoryValues) get(rv int64) *memoryValue {
	if len(v.version) == 0 {
		return nil
	}

	for i := len(v.version) - 1; i >= 0; i-- {
		v := v.version[i]
		if v.rv > rv {
			return v
		}
	}
	return nil
}

type memoryValue struct {
	deleted bool
	rv      int64
	ns      string
	name    string
	folder  string
	value   []byte
}

type memoryListIterator struct {
	rv      int64 // the RV at list time
	err     error
	index   int
	values  []*memoryValue
	current *memoryValue
}

func (c *memoryListIterator) add(ns *memoryNamespace) {
	for _, r := range ns.names {
		v := r.get(c.rv) // get the closest (but not over)
		if v != nil {
			c.values = append(c.values, v)
		}
	}
}

// Next implements ListIterator.
func (c *memoryListIterator) Next() bool {
	if c.err != nil {
		return false
	}
	c.current = nil
	c.index += 1
	if c.index >= len(c.values) {
		return false
	}
	c.current = c.values[c.index]
	return true
}

// Error implements ListIterator.
func (c *memoryListIterator) Error() error {
	return c.err
}

// ResourceVersion implements ListIterator.
func (c *memoryListIterator) ResourceVersion() int64 {
	return c.current.rv
}

// Value implements ListIterator.
func (c *memoryListIterator) Value() []byte {
	return c.current.value
}

// ContinueToken implements ListIterator.
func (c *memoryListIterator) ContinueToken() string {
	return fmt.Sprintf("%d", c.index)
}

// Name implements ListIterator.
func (c *memoryListIterator) Name() string {
	return c.current.name
}

// Namespace implements ListIterator.
func (c *memoryListIterator) Namespace() string {
	return c.current.name
}

var _ ListIterator = (*memoryListIterator)(nil)
