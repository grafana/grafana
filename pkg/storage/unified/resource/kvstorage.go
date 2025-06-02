package resource

import (
	"context"
	"encoding/binary"
	"fmt"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Unified storage backend

type KVStorageBackend struct {
	kv        KV
	dataStore *dataStore
	metaStore *metadataStore
}

func NewKVStorageBackend(kv KV) *KVStorageBackend {
	return &KVStorageBackend{
		kv:        kv,
		dataStore: newDataStore(kv),
		metaStore: newMetadataStore(kv),
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
	err = k.dataStore.Save(ctx, DataKey{
		Namespace: event.Key.Namespace,
		Group:     event.Key.Group,
		Resource:  event.Key.Resource,
		Name:      event.Key.Name,
		UUID:      uid,
		IsDeleted: event.Type == resourcepb.WatchEvent_DELETED,
	}, event.Value)
	if err != nil {
		return 0, fmt.Errorf("failed to write data: %w", err)
	}

	// Write metadata
	err = k.metaStore.Save(ctx, MetaDataObj{
		Key: resourcepb.ResourceKey{
			Namespace: event.Key.Namespace,
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Name:      event.Key.Name,
		},
		UID: uid,
		Value: MetaData{
			Folder:  event.Object.GetFolder(),
			Deleted: event.Type == resourcepb.WatchEvent_DELETED,
		},
	})
	if err != nil {
		return 0, fmt.Errorf("failed to write metadata: %w", err)
	}
	// TODO: Emit an event
	return rvFromUID(uid)
}

func (k *KVStorageBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	// TODO: List at revision
	if req.Key == nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 400, Message: "missing key"}}
	}
	meta, err := k.metaStore.GetLatest(ctx, *req.Key)
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
		UUID:      meta.UID,
	})
	if err != nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 500, Message: err.Error()}}
	}
	rv, err := rvFromUID(meta.UID)
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
func (k *KVStorageBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, fn func(ListIterator) error) (int64, error) {
	return 0, nil
}

// 	if req.Options == nil || req.Options.Key == nil {
// 		return 0, fmt.Errorf("missing options or key in ListRequest")
// 	}

// 	// Get inflight transactions and find smallest UUID
// 	inflightUids := make(map[string]int64)
// 	prefixInflightKey := fmt.Sprintf("%s/%s/%s/%s", prefixInflight, req.Options.Key.Group, req.Options.Key.Resource, req.Options.Key.Namespace)
// 	for obj, err := range k.kv.Get(ctx, prefixInflightKey, WithPrefix(prefixInflightKey)) {
// 		if err != nil {
// 			return 0, err
// 		}
// 		// Extract UID from the key (last part after the last /)
// 		parts := strings.Split(obj.Key, "/")
// 		if len(parts) > 0 {
// 			uid := parts[len(parts)-1]
// 			// Parse UUIDv7 timestamp
// 			u, err := uuid.Parse(uid)
// 			if err == nil {
// 				inflightUids[uid] = int64(u.Time())
// 			}
// 		}
// 	}

// 	// Find smallest inflight UUID timestamp
// 	var smallestInflightTS int64 = math.MaxInt64
// 	for _, ts := range inflightUids {
// 		if ts < smallestInflightTS {
// 			smallestInflightTS = ts
// 		}
// 	}

// 	// Get all data keys for the namespace
// 	prefixDataKey := fmt.Sprintf("%s/%s/%s/%s", prefixData, req.Options.Key.Group, req.Options.Key.Resource, req.Options.Key.Namespace)

// 	// Map to store latest version for each resource
// 	keys := []string{}
// 	metas := make(map[string]ObjectMeta)
// 	maxRV := int64(1) // TODO: is this correct?
// 	for obj, err := range k.kv.Get(ctx, prefixDataKey, WithPrefix(prefixDataKey)) {
// 		if err != nil {
// 			return 0, err
// 		}

// 		// Extract UID from the key
// 		parts := strings.Split(obj.Key, "/")

// 		if len(parts) > 0 { // TODO add error handling
// 			uid := parts[len(parts)-1]
// 			resourceKey := strings.Join(parts[:len(parts)-1], "/")

// 			// Parse UUIDv7 timestamp
// 			u, err := uuid.Parse(uid)
// 			if err != nil {
// 				continue
// 			}
// 			ts := int64(u.Time())

// 			if ts > maxRV {
// 				maxRV = ts
// 			}

// 			// Skip if this UID is newer than any inflight transaction
// 			if ts > smallestInflightTS {
// 				continue
// 			}
// 			var meta ObjectMeta
// 			if err := json.Unmarshal(obj.Value, &meta); err != nil {
// 				// TODO: handle error
// 				continue
// 			}
// 			// if it's the first time we see this resource, add it to the list
// 			if _, exists := metas[resourceKey]; !exists {
// 				keys = append(keys, resourcepb.resourceKey)
// 				metas[resourceKey] = meta
// 				continue
// 			}
// 			// If it's not, we replace depending on the resource version
// 			selectedUID, err := uuid.Parse(metas[resourceKey].UID)
// 			if err != nil {
// 				// TODO: handle error
// 				continue
// 			}

// 			selectedTS := int64(selectedUID.Time())
// 			if req.ResourceVersion != 0 {
// 				// find the latest version that is less than or equal to the requested version
// 				if ts <= req.ResourceVersion && ts > selectedTS {
// 					metas[resourceKey] = meta
// 				}
// 			} else if ts > selectedTS {
// 				// if no resource version specified, keep track of latest version
// 				metas[resourceKey] = meta
// 			}
// 		}
// 	}

// 	// Remove the keys that have been deleted
// 	for key, meta := range metas {
// 		if meta.Deleted {
// 			tmp := []string{}
// 			for _, k := range keys {
// 				if k != key {
// 					tmp = append(tmp, k)
// 				}
// 			}
// 			keys = tmp
// 		}
// 	}

// 	// Create iterator
// 	iter := &kvListIterator{
// 		ctx:          ctx,
// 		bucket:       k.bucket,
// 		listRV:       maxRV,
// 		keys:         keys,
// 		metas:        metas,
// 		currentIndex: -1,
// 	}

// 	return maxRV, fn(iter)
// }

// // kvListIterator implements ListIterator for KV storage
// type kvListIterator struct {
// 	ctx          context.Context
// 	bucket       *blob.Bucket
// 	listRV       int64
// 	keys         []string
// 	metas        map[string]ObjectMeta
// 	currentIndex int
// 	currentKey   string
// 	currentUID   string
// 	currentValue []byte
// 	err          error
// }

// func (i *kvListIterator) Next() bool {

// 	i.currentIndex++
// 	if i.currentIndex >= len(i.keys) {
// 		return false
// 	}
// 	i.currentKey = i.keys[i.currentIndex]
// 	i.currentUID = i.metas[i.currentKey].UID

// 	// Read value from blob store
// 	key := NewKeyBuilder(
// 		strings.Split(i.currentKey, "/")[2], // group
// 		strings.Split(i.currentKey, "/")[3], // resource
// 		strings.Split(i.currentKey, "/")[4], // namespace
// 		strings.Split(i.currentKey, "/")[5], // name
// 		i.currentUID,
// 	)

// 	var err error
// 	i.currentValue, err = i.bucket.ReadAll(i.ctx, key.BlobKey())
// 	if err != nil {
// 		i.err = err
// 		return false
// 	}

// 	return true
// }

// func (i *kvListIterator) Error() error {
// 	return i.err
// }

// func (i *kvListIterator) ContinueToken() string {
// 	if i.currentIndex < 0 || i.currentIndex >= len(i.keys) {
// 		return ""
// 	}
// 	return fmt.Sprintf("index:%d/key:%s", i.currentIndex, i.currentKey)
// }

// func (i *kvListIterator) ResourceVersion() int64 {
// 	if i.currentUID == "" {
// 		return 0
// 	}
// 	u, err := uuid.Parse(i.currentUID)
// 	if err != nil {
// 		return 0
// 	}
// 	return int64(u.Time())
// }

// func (i *kvListIterator) Namespace() string {
// 	if i.currentKey == "" {
// 		return ""
// 	}
// 	parts := strings.Split(i.currentKey, "/")
// 	if len(parts) > 4 {
// 		return parts[4]
// 	}
// 	return ""
// }

// func (i *kvListIterator) Name() string {
// 	if i.currentKey == "" {
// 		return ""
// 	}
// 	parts := strings.Split(i.currentKey, "/")
// 	if len(parts) > 5 {
// 		return parts[5]
// 	}
// 	return ""
// }

// func (i *kvListIterator) Folder() string {
// 	if i.currentKey == "" {
// 		return ""
// 	}
// 	return i.metas[i.currentKey].Folder
// }

// func (i *kvListIterator) Value() []byte {
// 	return i.currentValue
// }

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
	close(events)                           // TODO: remove this
	return events, nil
}

// GetResourceStats returns resource stats within the storage backend.
func (k *KVStorageBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]ResourceStats, error) {
	// In a real implementation, this would return resource stats.
	// For now, we simply return an empty slice.
	return []ResourceStats{}, nil
}

// func selectUID(uids []string, revision int64) string {
// 	if len(uids) == 0 {
// 		return ""
// 	}

// 	// Parse all UIDs as UUIDs and get their timestamps
// 	timestamps := make([]int64, len(uids))
// 	for i, uid := range uids {
// 		u, err := uuid.Parse(uid)
// 		if err != nil {
// 			// If parsing fails, use 0 as timestamp
// 			timestamps[i] = 0
// 			continue
// 		}
// 		timestamps[i] = int64(u.Time())
// 	}

// 	// If revision is 0, return the greatest UID
// 	if revision == 0 {
// 		maxTS := timestamps[0]
// 		maxUID := uids[0]
// 		for i, ts := range timestamps {
// 			if ts > maxTS {
// 				maxTS = ts
// 				maxUID = uids[i]
// 			}
// 		}
// 		return maxUID
// 	}

// 	// Find the biggest timestamp lower than revision
// 	maxLowerTS := int64(-1)
// 	maxLowerUID := ""
// 	for i, ts := range timestamps {
// 		if ts < revision && ts > maxLowerTS {
// 			maxLowerTS = ts
// 			maxLowerUID = uids[i]
// 		}
// 	}

// 	// If no timestamp is lower than revision, return the greatest UID
// 	if maxLowerUID == "" {
// 		maxTS := timestamps[0]
// 		maxUID := uids[0]
// 		for i, ts := range timestamps {
// 			if ts > maxTS {
// 				maxTS = ts
// 				maxUID = uids[i]
// 			}
// 		}
// 		return maxUID
// 	}

// 	return maxLowerUID
// }
