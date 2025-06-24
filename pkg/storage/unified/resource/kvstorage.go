package resource

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"math/rand/v2"
	"sort"
	"strings"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Unified storage backend

type KVStorageBackend struct {
	snowflake *snowflake.Node
	kv        KV
	dataStore *dataStore
	metaStore *metadataStore
	notifier  *kvNotifier
}

var _ StorageBackend = &KVStorageBackend{}

func NewKVStorageBackend(kv KV) *KVStorageBackend {
	s, err := snowflake.NewNode(rand.Int64N(1024))
	if err != nil {
		panic(err)
	}
	return &KVStorageBackend{
		kv:        kv,
		dataStore: newDataStore(kv),
		metaStore: newMetadataStore(kv),
		notifier:  newKVNotifier(kv, KVNotifierOptions{}),
		snowflake: s,
	}
}

// // WriteEvent writes a resource event (create/update/delete) to the storage backend.
func (k *KVStorageBackend) WriteEvent(ctx context.Context, event WriteEvent) (int64, error) {
	rv := k.snowflake.Generate().Int64()

	// Write data.
	var action DataAction
	switch event.Type {
	case resourcepb.WatchEvent_ADDED:
		action = DataActionCreated
	case resourcepb.WatchEvent_MODIFIED:
		action = DataActionUpdated
	case resourcepb.WatchEvent_DELETED:
		action = DataActionDeleted
	default:
		return 0, fmt.Errorf("invalid event type: %d", event.Type)
	}
	err := k.dataStore.Save(ctx, DataKey{
		Namespace:       event.Key.Namespace,
		Group:           event.Key.Group,
		Resource:        event.Key.Resource,
		Name:            event.Key.Name,
		ResourceVersion: rv,
		Action:          action,
	}, io.NopCloser(bytes.NewReader(event.Value)))
	if err != nil {
		return 0, fmt.Errorf("failed to write data: %w", err)
	}

	// Write metadata
	err = k.metaStore.Save(ctx, MetaDataObj{
		Key: MetaDataKey{
			Namespace:       event.Key.Namespace,
			Group:           event.Key.Group,
			Resource:        event.Key.Resource,
			Name:            event.Key.Name,
			ResourceVersion: rv,
			Action:          action,
			Folder:          event.Object.GetFolder(),
		},
		Value: MetaData{},
	})
	if err != nil {
		return 0, fmt.Errorf("failed to write metadata: %w", err)
	}
	// TODO: Emit an event
	err = k.notifier.Send(ctx, Event{
		Namespace:       event.Key.Namespace,
		Group:           event.Key.Group,
		Resource:        event.Key.Resource,
		Name:            event.Key.Name,
		ResourceVersion: rv,
		Action:          action,
		Folder:          event.Object.GetFolder(),
		PreviousRV:      event.PreviousRV,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to send event: %w", err)
	}
	return rv, nil
}

func (k *KVStorageBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	if req.Key == nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 400, Message: "missing key"}}
	}
	meta, err := k.metaStore.GetAtRevision(ctx, ListRequestKey{
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
		Namespace:       req.Key.Namespace,
		Group:           req.Key.Group,
		Resource:        req.Key.Resource,
		Name:            req.Key.Name,
		ResourceVersion: meta.Key.ResourceVersion,
		Action:          meta.Key.Action,
	})
	if err != nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 500, Message: err.Error()}}
	}
	value, err := io.ReadAll(data)
	if err != nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 500, Message: err.Error()}}
	}
	return &BackendReadResponse{
		Key:             req.Key,
		ResourceVersion: meta.Key.ResourceVersion,
		Value:           value,
		Folder:          meta.Key.Folder,
	}
}

// // ListIterator returns an iterator for listing resources.
func (k *KVStorageBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
	if req.Options == nil || req.Options.Key == nil {
		return 0, fmt.Errorf("missing options or key in ListRequest")
	}
	// Parse continue token if provided
	offset := int64(0)
	resourceVersion := req.ResourceVersion
	if req.NextPageToken != "" {
		token, err := GetContinueToken(req.NextPageToken)
		if err != nil {
			return 0, fmt.Errorf("invalid continue token: %w", err)
		}
		offset = token.StartOffset
		resourceVersion = token.ResourceVersion
	}
	// For now we return the current time as the resource version
	listRV := k.snowflake.Generate().Int64()
	if resourceVersion > 0 {
		listRV = resourceVersion
	}

	// Fetch the latest objects
	keys := make([]MetaDataObj, 0)
	idx := 0
	for metaObj, err := range k.metaStore.ListAtRevision(ctx, ListRequestKey{
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
		// Only fetch the first limit items + 1 to get the next token.
		if len(keys) >= int(req.Limit+1) {
			break
		}
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

	i.rv, i.err = i.keys[i.currentIndex].Key.ResourceVersion, nil

	data, err := i.dataStore.Get(i.ctx, DataKey{
		Namespace:       i.keys[i.currentIndex].Key.Namespace,
		Group:           i.keys[i.currentIndex].Key.Group,
		Resource:        i.keys[i.currentIndex].Key.Resource,
		Name:            i.keys[i.currentIndex].Key.Name,
		ResourceVersion: i.keys[i.currentIndex].Key.ResourceVersion,
		Action:          i.keys[i.currentIndex].Key.Action,
	})
	if err != nil {
		i.err = err
		return false
	}

	i.value, i.err = io.ReadAll(data)
	if i.err != nil {
		return false
	}

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
	return i.keys[i.currentIndex].Key.Folder
}

func (i *kvListIterator) Value() []byte {
	return i.value
}

// ListHistory is like ListIterator, but it returns the history of a resource.
func (k *KVStorageBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, fn func(ListIterator) error) (int64, error) {
	if req.Options == nil || req.Options.Key == nil {
		return 0, fmt.Errorf("missing options or key in ListRequest")
	}
	key := req.Options.Key
	if key.Group == "" {
		return 0, fmt.Errorf("group is required")
	}
	if key.Resource == "" {
		return 0, fmt.Errorf("resource is required")
	}
	if key.Namespace == "" {
		return 0, fmt.Errorf("namespace is required")
	}
	if key.Name == "" {
		return 0, fmt.Errorf("name is required")
	}

	// Parse continue token if provided
	lastSeenRV := int64(0)
	sortAscending := req.GetVersionMatchV2() == resourcepb.ResourceVersionMatchV2_NotOlderThan
	if req.NextPageToken != "" {
		token, err := GetContinueToken(req.NextPageToken)
		if err != nil {
			return 0, fmt.Errorf("invalid continue token: %w", err)
		}
		lastSeenRV = token.ResourceVersion
		sortAscending = token.SortAscending
	}

	// Generate a new resource version for the list
	listRV := k.snowflake.Generate().Int64()

	// Get all history entries by iterating through datastore keys
	var historyEntries []DataObj

	// Use datastore.Keys to get all data keys for this specific resource
	for dataKey, err := range k.dataStore.Keys(ctx, ListRequestKey{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
		Name:      key.Name,
	}) {
		if err != nil {
			return 0, err
		}

		// Get the object data using datastore
		data, err := k.dataStore.Get(ctx, dataKey)
		if err != nil {
			return 0, err
		}

		historyEntries = append(historyEntries, DataObj{
			Key:   dataKey,
			Value: data,
		})
	}

	// Handle trash differently from regular history
	if req.Source == resourcepb.ListRequest_TRASH {
		return k.processTrashEntries(ctx, req, fn, historyEntries, lastSeenRV, sortAscending, listRV)
	}

	// Apply filtering based on version match
	versionMatch := req.GetVersionMatchV2()

	if versionMatch == resourcepb.ResourceVersionMatchV2_Exact {
		if req.ResourceVersion <= 0 {
			return 0, fmt.Errorf("expecting an explicit resource version query when using Exact matching")
		}
		var exactEntries []DataObj
		for _, entry := range historyEntries {
			if entry.Key.ResourceVersion == req.ResourceVersion {
				exactEntries = append(exactEntries, entry)
			}
		}
		historyEntries = exactEntries
	} else if versionMatch == resourcepb.ResourceVersionMatchV2_NotOlderThan {
		if req.ResourceVersion > 0 {
			var filteredEntries []DataObj
			for _, entry := range historyEntries {
				if entry.Key.ResourceVersion >= req.ResourceVersion {
					filteredEntries = append(filteredEntries, entry)
				}
			}
			historyEntries = filteredEntries
		}
	} else {
		if req.ResourceVersion > 0 {
			var filteredEntries []DataObj
			for _, entry := range historyEntries {
				if entry.Key.ResourceVersion <= req.ResourceVersion {
					filteredEntries = append(filteredEntries, entry)
				}
			}
			historyEntries = filteredEntries
		}
	}

	// Apply "live" history logic: ignore events before the last delete
	useLatestDeletionAsMinRV := req.ResourceVersion == 0 && req.Source != resourcepb.ListRequest_TRASH && versionMatch != resourcepb.ResourceVersionMatchV2_Exact
	if useLatestDeletionAsMinRV {
		latestDeleteRV := int64(0)
		for _, entry := range historyEntries {
			if entry.Key.Action == DataActionDeleted && entry.Key.ResourceVersion > latestDeleteRV {
				latestDeleteRV = entry.Key.ResourceVersion
			}
		}
		if latestDeleteRV > 0 {
			var liveEntries []DataObj
			for _, entry := range historyEntries {
				if entry.Key.ResourceVersion > latestDeleteRV {
					liveEntries = append(liveEntries, entry)
				}
			}
			historyEntries = liveEntries
		}
	}

	// Sort the entries if not already sorted correctly
	if sortAscending {
		sort.Slice(historyEntries, func(i, j int) bool {
			return historyEntries[i].Key.ResourceVersion < historyEntries[j].Key.ResourceVersion
		})
	} else {
		sort.Slice(historyEntries, func(i, j int) bool {
			return historyEntries[i].Key.ResourceVersion > historyEntries[j].Key.ResourceVersion
		})
	}

	// Pagination: filter out items up to and including lastSeenRV
	var pagedEntries []DataObj
	for _, entry := range historyEntries {
		if lastSeenRV == 0 {
			pagedEntries = append(pagedEntries, entry)
		} else if sortAscending && entry.Key.ResourceVersion > lastSeenRV {
			pagedEntries = append(pagedEntries, entry)
		} else if !sortAscending && entry.Key.ResourceVersion < lastSeenRV {
			pagedEntries = append(pagedEntries, entry)
		}
	}

	// Apply limit
	hasMore := false
	if req.Limit > 0 && len(pagedEntries) > int(req.Limit) {
		hasMore = true
		pagedEntries = pagedEntries[:req.Limit]
	}

	iter := kvHistoryIterator{
		entries:       pagedEntries,
		currentIndex:  -1,
		ctx:           ctx,
		listRV:        listRV,
		sortAscending: sortAscending,
		hasMore:       hasMore,
	}

	err := fn(&iter)
	if err != nil {
		return 0, err
	}

	return listRV, nil
}

// processTrashEntries handles the special case of listing deleted items (trash)
func (k *KVStorageBackend) processTrashEntries(ctx context.Context, req *resourcepb.ListRequest, fn func(ListIterator) error, historyEntries []DataObj, lastSeenRV int64, sortAscending bool, listRV int64) (int64, error) {
	// Filter to only deleted entries
	var deletedEntries []DataObj
	for _, entry := range historyEntries {
		if entry.Key.Action == DataActionDeleted {
			deletedEntries = append(deletedEntries, entry)
		}
	}

	// Check if the resource currently exists (is live)
	// If it exists, don't return any trash entries
	_, err := k.metaStore.GetLatest(ctx, ListRequestKey{
		Namespace: req.Options.Key.Namespace,
		Group:     req.Options.Key.Group,
		Resource:  req.Options.Key.Resource,
		Name:      req.Options.Key.Name,
	})

	var trashEntries []DataObj
	if err == ErrNotFound {
		// Resource doesn't exist currently, so we can return the latest delete
		// Find the latest delete event
		var latestDelete *DataObj
		for _, entry := range deletedEntries {
			if latestDelete == nil || entry.Key.ResourceVersion > latestDelete.Key.ResourceVersion {
				latestDelete = &entry
			}
		}
		if latestDelete != nil {
			trashEntries = append(trashEntries, *latestDelete)
		}
	}
	// If err != ErrNotFound, the resource exists, so no trash entries should be returned

	// Apply version filtering
	versionMatch := req.GetVersionMatchV2()
	if versionMatch == resourcepb.ResourceVersionMatchV2_Exact {
		if req.ResourceVersion <= 0 {
			return 0, fmt.Errorf("expecting an explicit resource version query when using Exact matching")
		}
		var exactEntries []DataObj
		for _, entry := range trashEntries {
			if entry.Key.ResourceVersion == req.ResourceVersion {
				exactEntries = append(exactEntries, entry)
			}
		}
		trashEntries = exactEntries
	} else if versionMatch == resourcepb.ResourceVersionMatchV2_NotOlderThan {
		if req.ResourceVersion > 0 {
			var filteredEntries []DataObj
			for _, entry := range trashEntries {
				if entry.Key.ResourceVersion >= req.ResourceVersion {
					filteredEntries = append(filteredEntries, entry)
				}
			}
			trashEntries = filteredEntries
		}
	} else {
		if req.ResourceVersion > 0 {
			var filteredEntries []DataObj
			for _, entry := range trashEntries {
				if entry.Key.ResourceVersion <= req.ResourceVersion {
					filteredEntries = append(filteredEntries, entry)
				}
			}
			trashEntries = filteredEntries
		}
	}

	// Sort the entries
	if sortAscending {
		sort.Slice(trashEntries, func(i, j int) bool {
			return trashEntries[i].Key.ResourceVersion < trashEntries[j].Key.ResourceVersion
		})
	} else {
		sort.Slice(trashEntries, func(i, j int) bool {
			return trashEntries[i].Key.ResourceVersion > trashEntries[j].Key.ResourceVersion
		})
	}

	// Pagination: filter out items up to and including lastSeenRV
	var pagedEntries []DataObj
	for _, entry := range trashEntries {
		if lastSeenRV == 0 {
			pagedEntries = append(pagedEntries, entry)
		} else if sortAscending && entry.Key.ResourceVersion > lastSeenRV {
			pagedEntries = append(pagedEntries, entry)
		} else if !sortAscending && entry.Key.ResourceVersion < lastSeenRV {
			pagedEntries = append(pagedEntries, entry)
		}
	}

	// Apply limit
	hasMore := false
	if req.Limit > 0 && len(pagedEntries) > int(req.Limit) {
		hasMore = true
		pagedEntries = pagedEntries[:req.Limit]
	}

	iter := kvHistoryIterator{
		entries:       pagedEntries,
		currentIndex:  -1,
		ctx:           ctx,
		listRV:        listRV,
		sortAscending: sortAscending,
		hasMore:       hasMore,
	}

	err = fn(&iter)
	if err != nil {
		return 0, err
	}

	return listRV, nil
}

// kvHistoryIterator implements ListIterator for KV storage history
type kvHistoryIterator struct {
	ctx           context.Context
	entries       []DataObj
	currentIndex  int
	listRV        int64
	sortAscending bool
	hasMore       bool

	// current
	rv    int64
	err   error
	value []byte
}

func (i *kvHistoryIterator) Next() bool {
	i.currentIndex++

	if i.currentIndex >= len(i.entries) {
		return false
	}

	entry := i.entries[i.currentIndex]
	i.rv = entry.Key.ResourceVersion

	// Read the value from the ReadCloser
	data, err := io.ReadAll(entry.Value)
	if err != nil {
		i.err = err
		return false
	}
	i.value = data
	i.err = nil

	return true
}

func (i *kvHistoryIterator) Error() error {
	return i.err
}

func (i *kvHistoryIterator) ContinueToken() string {
	if !i.hasMore {
		return ""
	}
	// Use the resource version from the last item in the current page
	var lastRV int64
	if len(i.entries) > 0 {
		lastRV = i.entries[len(i.entries)-1].Key.ResourceVersion
	} else {
		// Fallback to current RV if no entries
		lastRV = i.rv
	}
	token := ContinueToken{
		StartOffset:     i.rv,
		ResourceVersion: lastRV,
		SortAscending:   i.sortAscending,
	}
	tokenStr := token.String()
	return tokenStr
}

// HasMore returns true if there are more items after the current position
func (i *kvHistoryIterator) HasMore() bool {
	return i.currentIndex < len(i.entries)-1
}

func (i *kvHistoryIterator) ResourceVersion() int64 {
	return i.rv
}

func (i *kvHistoryIterator) Namespace() string {
	if i.currentIndex >= 0 && i.currentIndex < len(i.entries) {
		return i.entries[i.currentIndex].Key.Namespace
	}
	return ""
}

func (i *kvHistoryIterator) Name() string {
	if i.currentIndex >= 0 && i.currentIndex < len(i.entries) {
		return i.entries[i.currentIndex].Key.Name
	}
	return ""
}

func (i *kvHistoryIterator) Folder() string {
	// DataObj doesn't contain folder information, so we return empty string
	// In a real implementation, we might need to get this from metadata
	return ""
}

func (i *kvHistoryIterator) Value() []byte {
	return i.value
}

// WatchWriteEvents returns a channel that receives write events.
func (k *KVStorageBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	// Create a channel to receive events
	events := make(chan *WrittenEvent, 10000) // TODO: make this configurable

	notifierEvents, err := k.notifier.Notify(ctx)
	if err != nil {
		return nil, err
	}
	go func() {
		for event := range notifierEvents {
			// fetch the data
			dataReader, err := k.dataStore.Get(ctx, DataKey{
				Namespace:       event.Namespace,
				Group:           event.Group,
				Resource:        event.Resource,
				Name:            event.Name,
				ResourceVersion: event.ResourceVersion,
				Action:          event.Action,
			})
			if err != nil {
				return
			}
			data, err := io.ReadAll(dataReader)
			if err != nil {
				return
			}
			var t resourcepb.WatchEvent_Type
			switch event.Action {
			case DataActionCreated:
				t = resourcepb.WatchEvent_ADDED
			case DataActionUpdated:
				t = resourcepb.WatchEvent_MODIFIED
			case DataActionDeleted:
				t = resourcepb.WatchEvent_DELETED
			}

			events <- &WrittenEvent{
				Key: &resourcepb.ResourceKey{
					Namespace: event.Namespace,
					Group:     event.Group,
					Resource:  event.Resource,
					Name:      event.Name,
				},
				Type:            t,
				Folder:          event.Folder,
				Value:           data,
				ResourceVersion: event.ResourceVersion,
				PreviousRV:      event.PreviousRV,
				Timestamp:       event.ResourceVersion / time.Second.Nanoseconds(), // convert to seconds
			}
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

	// Use datastore.Keys to get all data keys for the namespace
	for dataKey, err := range k.dataStore.Keys(ctx, ListRequestKey{Namespace: namespace}) {
		if err != nil {
			return nil, err
		}
		key := fmt.Sprintf("%s/%s/%s", dataKey.Namespace, dataKey.Group, dataKey.Resource)
		if _, ok := res[key]; !ok {
			res[key] = make(map[string]bool)
			rvs[key] = 1
		}
		res[key][dataKey.Name] = dataKey.Action != DataActionDeleted
		rvs[key] = dataKey.ResourceVersion
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
