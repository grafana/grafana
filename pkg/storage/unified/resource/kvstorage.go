package resource

import (
	"context"
	"encoding/binary"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Unified storage backend

type KVStorageBackend struct {
	kv        KV
	dataStore *dataStore
	metaStore *metadataStore

	events chan *WrittenEvent // TODO: replace with a poller base
}

func NewKVStorageBackend(kv KV) *KVStorageBackend {
	return &KVStorageBackend{
		kv:        kv,
		dataStore: newDataStore(kv),
		metaStore: newMetadataStore(kv),
		events:    make(chan *WrittenEvent, 100),
	}
}

// This returns the resource version in nanoseconds timestamp
// UUIDv7 includes the time in ms but in the first 7 bytes.
// The last 2 bytes are the version and a unique sequence number.
// The sequence number is really useful to avoid conflicts when writing
// multiple events in the same millisecond.
func rvFromUID(uid uuid.UUID) (int64, error) {
	// Check if the UUID is a version 7 UUID
	if uid.Version() != 7 {
		return 0, fmt.Errorf("invalid uuid version: %d", uid.Version())
	}
	return int64(binary.BigEndian.Uint64(uid[:8])), nil
}

// // WriteEvent writes a resource event (create/update/delete) to the storage backend.
func (k *KVStorageBackend) WriteEvent(ctx context.Context, event WriteEvent) (int64, error) {
	// Generate a new UUIDv7
	uid, err := uuid.NewV7()
	if err != nil {
		return 0, fmt.Errorf("failed to generate uuid: %w", err)
	}
	// TODO: check we are not generating a uuid in the past?

	// Write data.
	var action MetaDataAction
	switch event.Type {
	case resourcepb.WatchEvent_ADDED:
		action = MetaDataActionCreated
	case resourcepb.WatchEvent_MODIFIED:
		action = MetaDataActionUpdated
	case resourcepb.WatchEvent_DELETED:
		action = MetaDataActionDeleted
	default:
		return 0, fmt.Errorf("invalid event type: %d", event.Type)
	}
	err = k.dataStore.Save(ctx, DataKey{
		Namespace: event.Key.Namespace,
		Group:     event.Key.Group,
		Resource:  event.Key.Resource,
		Name:      event.Key.Name,
		UID:       uid,
		Action:    action,
	}, event.Value)
	if err != nil {
		return 0, fmt.Errorf("failed to write data: %w", err)
	}

	// Write metadata
	err = k.metaStore.Save(ctx, MetaDataObj{
		Key: MetaDataKey{
			Namespace: event.Key.Namespace,
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Name:      event.Key.Name,
			UID:       uid,
			Action:    action,
		},
		Value: MetaData{
			Folder: event.Object.GetFolder(),
		},
	})
	if err != nil {
		return 0, fmt.Errorf("failed to write metadata: %w", err)
	}
	// TODO: Emit an event
	select {
	case k.events <- &WrittenEvent{
		Key: &resourcepb.ResourceKey{
			Namespace: event.Key.Namespace,
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Name:      event.Key.Name,
		},
		Type:  event.Type,
		Value: event.Value,
	}:
	default:
		fmt.Println("event channel is full, dropping event")
	}
	return rvFromUID(uid)
}

func (k *KVStorageBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	if req.Key == nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 400, Message: "missing key"}}
	}
	meta, err := k.metaStore.GetAt(ctx, ListRequestKey{
		Namespace: req.Key.Namespace,
		Group:     req.Key.Group,
		Resource:  req.Key.Resource,
		Name:      req.Key.Name,
	}, req.ResourceVersion)
	if err == ErrNotFound {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 404, Message: "not found"}}
	} else if err != nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 500, Message: err.Error()}}
	}
	data, err := k.dataStore.Get(ctx, DataKey{
		Namespace: req.Key.Namespace,
		Group:     req.Key.Group,
		Resource:  req.Key.Resource,
		Name:      req.Key.Name,
		UID:       meta.Key.UID,
		Action:    meta.Key.Action,
	})
	if err != nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 500, Message: err.Error()}}
	}
	rv, err := rvFromUID(meta.Key.UID)
	if err != nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 500, Message: err.Error()}}
	}
	return &BackendReadResponse{
		Key:             req.Key,
		ResourceVersion: rv,
		Value:           data,
		Folder:          meta.Value.Folder,
	}
}

// // ListIterator returns an iterator for listing resources.
func (k *KVStorageBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
	if req.Options == nil || req.Options.Key == nil {
		return 0, fmt.Errorf("missing options or key in ListRequest")
	}
	resourceVersion := req.ResourceVersion
	offset := int64(0)
	if req.NextPageToken != "" {
		token, err := GetContinueToken(req.NextPageToken)
		if err != nil {
			return 0, err
		}
		offset = token.StartOffset
		resourceVersion = token.ResourceVersion
	}
	listRV := time.Now().UnixNano() // For now we return the current time as the resource version
	if resourceVersion > 0 {
		listRV = resourceVersion
	}

	// Fetch the latest objects
	keys := make([]MetaDataObj, 0, req.Limit)
	idx := 0
	for metaObj, err := range k.metaStore.ListAt(ctx, ListRequestKey{
		Namespace: req.Options.Key.Namespace,
		Group:     req.Options.Key.Group,
		Resource:  req.Options.Key.Resource,
		Name:      req.Options.Key.Name,
	}, resourceVersion) {
		if err != nil {
			return 0, err
		}
		// Skip the first offset items. This is not efficient, but it's a simple way to implement it for now.
		if idx < int(offset) {
			idx++
			continue
		}
		keys = append(keys, MetaDataObj{ // TODO: do we need a copy here?
			Key:   metaObj.Key,
			Value: metaObj.Value,
		})
	}
	iter := kvListIterator{
		keys:         keys,
		currentIndex: -1,
		ctx:          ctx,
		listRV:       listRV,
		offset:       offset,
		dataStore:    k.dataStore,
	}
	err := cb(&iter)
	if err != nil {
		return 0, err
	}

	return listRV, nil
}

// kvListIterator implements ListIterator for KV storage
type kvListIterator struct {
	ctx          context.Context
	keys         []MetaDataObj
	currentIndex int
	dataStore    *dataStore
	listRV       int64
	offset       int64

	// current
	rv    int64
	err   error
	value []byte
}

func (i *kvListIterator) Next() bool {
	i.currentIndex++

	if i.currentIndex >= len(i.keys) {
		return false
	}

	i.rv, i.err = rvFromUID(i.keys[i.currentIndex].Key.UID)
	if i.err != nil {
		return true
	}
	i.value, i.err = i.dataStore.Get(i.ctx, DataKey{
		Namespace: i.keys[i.currentIndex].Key.Namespace,
		Group:     i.keys[i.currentIndex].Key.Group,
		Resource:  i.keys[i.currentIndex].Key.Resource,
		Name:      i.keys[i.currentIndex].Key.Name,
		UID:       i.keys[i.currentIndex].Key.UID,
		Action:    i.keys[i.currentIndex].Key.Action,
	})

	// increment the offset
	i.offset++

	return true
}

func (i *kvListIterator) Error() error {
	return nil
}

func (i *kvListIterator) ContinueToken() string {
	return ContinueToken{
		StartOffset:     i.offset,
		ResourceVersion: i.listRV,
	}.String()
}

func (i *kvListIterator) ResourceVersion() int64 {
	return i.rv
}

func (i *kvListIterator) Namespace() string {
	return i.keys[i.currentIndex].Key.Namespace
}

func (i *kvListIterator) Name() string {
	return i.keys[i.currentIndex].Key.Name
}

func (i *kvListIterator) Folder() string {
	return i.keys[i.currentIndex].Value.Folder
}

func (i *kvListIterator) Value() []byte {
	return i.value
}

// ListHistory is like ListIterator, but it returns the history of a resource.
func (k *KVStorageBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, fn func(ListIterator) error) (int64, error) {
	// In a real implementation, this would iterate over the history of the resource.
	// For now, we simply return an error.
	return 0, nil
}

// WatchWriteEvents returns a channel that receives write events.
func (k *KVStorageBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	// Create a channel to receive events
	events := make(chan *WrittenEvent, 100) // TODO: make this configurable
	go func() {
		for event := range k.events {
			events <- event
		}
		close(events)
	}()
	return events, nil
}

// GetResourceStats returns resource stats within the storage backend.
// TODO: this isn't very efficient, we should use a more efficient algorithm.
func (k *KVStorageBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]ResourceStats, error) {
	stats := make([]ResourceStats, 0)
	res := make(map[string]map[string]bool)
	rvs := make(map[string]int64)
	for obj, err := range k.dataStore.List(ctx, ListRequestKey{Namespace: namespace}) {
		if err != nil {
			return nil, err
		}
		key := fmt.Sprintf("%s/%s/%s", obj.Key.Namespace, obj.Key.Group, obj.Key.Resource)
		if _, ok := res[key]; !ok {
			res[key] = make(map[string]bool)
			rvs[key] = 1
		}
		res[key][obj.Key.Name] = obj.Key.Action != MetaDataActionDeleted
		rv, err := rvFromUID(obj.Key.UID)
		if err != nil {
			return nil, err
		}
		rvs[key] = rv
	}
	for key, names := range res {
		parts := strings.Split(key, "/")
		count := int64(0)
		for _, exists := range names {
			if exists {
				count++
			}
		}
		if count <= int64(minCount) {
			continue
		}
		stats = append(stats, ResourceStats{
			NamespacedResource: NamespacedResource{
				Namespace: parts[0],
				Group:     parts[1],
				Resource:  parts[2],
			},
			Count:           count,
			ResourceVersion: rvs[key],
		})
	}
	return stats, nil
}
