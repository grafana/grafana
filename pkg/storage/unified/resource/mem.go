package resource

import (
	context "context"
	"crypto/sha1"
	"encoding/base64"
	"sync"
	"sync/atomic"
)

type MemoryStore interface {
	Read(context.Context, *ReadRequest) (*ReadResponse, error)
	WriteEvent(context.Context, *WriteEvent) (int64, error)
}

func NewMemoryStore() MemoryStore {
	return &memoryStore{
		store: make(map[string]*namespacedResources),
	}
}

type memoryStore struct {
	counter atomic.Int64
	mutex   sync.RWMutex

	// Key is group+resource
	store map[string]*namespacedResources
}

type namespacedResources struct {
	// Lookup by resource name
	namespace map[string]*resourceInfo
}

type resourceInfo struct {
	history []resourceValue
}

type resourceValue struct {
	rv       int64
	event    WriteEvent // saves the whole thing for now
	blobHash string
}

func (s *memoryStore) get(key *ResourceKey) *resourceValue {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	found, ok := s.store[key.Group+"/"+key.Resource]
	if !ok || found.namespace == nil {
		return nil
	}
	resource, ok := found.namespace[key.Namespace]
	if !ok || len(resource.history) < 1 {
		return nil
	}
	if key.ResourceVersion > 0 {
		for idx, v := range resource.history {
			if v.rv == key.ResourceVersion {
				return &resource.history[idx]
			}
		}
	}
	latest := resource.history[0]
	if latest.event.Operation == ResourceOperation_DELETED {
		return nil
	}
	return &latest // the first one
}

func (s *memoryStore) Read(_ context.Context, req *ReadRequest) (*ReadResponse, error) {
	val := s.get(req.Key)
	if val == nil {
		return &ReadResponse{
			Status: &StatusResult{
				Status: "Failure",
				Reason: "not found",
				Code:   404,
			},
		}, nil
	}
	rsp := &ReadResponse{
		ResourceVersion: val.rv,
		Value:           val.event.Value,
	}
	if val.event.Blob != nil {
		rsp.BlobUrl = "#blob"
	}
	return rsp, nil
}

func (s *memoryStore) WriteEvent(_ context.Context, req *WriteEvent) (int64, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	val := resourceValue{
		rv:    s.counter.Add(1),
		event: *req,
	}
	if req.Blob != nil {
		hasher := sha1.New()
		_, err := hasher.Write(req.Blob.Value)
		if err != nil {
			return 0, err
		}
		val.blobHash = base64.URLEncoding.EncodeToString(hasher.Sum(nil))
	}

	// Now append the value
	key := req.Key
	found, ok := s.store[key.Group+"/"+key.Resource]
	if !ok {
		found = &namespacedResources{}
		s.store[key.Group+"/"+key.Resource] = found
	}
	if found.namespace == nil {
		found.namespace = make(map[string]*resourceInfo)
	}

	resource, ok := found.namespace[key.Namespace]
	if !ok {
		resource = &resourceInfo{}
		found.namespace[key.Namespace] = resource
	}
	if resource.history == nil {
		resource.history = []resourceValue{val}
	} else {
		resource.history = append([]resourceValue{val}, resource.history...)
	}
	return val.rv, nil
}
