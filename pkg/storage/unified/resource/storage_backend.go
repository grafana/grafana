package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"iter"
	"math/rand/v2"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/debouncer"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	defaultListBufferSize       = 100
	prunerMaxEvents             = 20
	defaultEventRetentionPeriod = 24 * time.Hour // Default event retention period
)

// kvStorageBackend Unified storage backend based on KV storage.
type kvStorageBackend struct {
	snowflake            *snowflake.Node
	kv                   KV
	dataStore            *dataStore
	metaStore            *metadataStore
	eventStore           *eventStore
	notifier             *notifier
	builder              DocumentBuilder
	log                  logging.Logger
	withPruner           bool
	eventRetentionPeriod time.Duration
	historyPruner        Pruner
	//tracer        trace.Tracer
	//reg           prometheus.Registerer
}

var _ StorageBackend = &kvStorageBackend{}

type KvBackendOptions struct {
	KvStore              KV
	WithPruner           bool
	EventRetentionPeriod time.Duration         // How long to keep events (default: 24 hours)
	Tracer               trace.Tracer          // TODO add tracing
	Reg                  prometheus.Registerer // TODO add metrics
}

func NewKvStorageBackend(opts KvBackendOptions) (StorageBackend, error) {
	ctx := context.Background()
	kv := opts.KvStore

	s, err := snowflake.NewNode(rand.Int64N(1024))
	if err != nil {
		return nil, fmt.Errorf("failed to create snowflake node: %w", err)
	}
	eventStore := newEventStore(kv)

	eventRetentionPeriod := opts.EventRetentionPeriod
	if eventRetentionPeriod <= 0 {
		eventRetentionPeriod = defaultEventRetentionPeriod
	}

	backend := &kvStorageBackend{
		kv:                   kv,
		dataStore:            newDataStore(kv),
		metaStore:            newMetadataStore(kv),
		eventStore:           eventStore,
		notifier:             newNotifier(eventStore, notifierOptions{}),
		snowflake:            s,
		builder:              StandardDocumentBuilder(), // For now we use the standard document builder.
		log:                  &logging.NoOpLogger{},     // Make this configurable
		eventRetentionPeriod: eventRetentionPeriod,
	}
	err = backend.initPruner(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize pruner: %w", err)
	}

	// Start the event cleanup background job
	backend.startEventCleanup(ctx)

	return backend, nil
}

// startEventCleanup starts a background goroutine that periodically cleans up old events
func (k *kvStorageBackend) startEventCleanup(ctx context.Context) {
	go func() {
		// Run cleanup every hour
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()

		// Run initial cleanup after a short delay
		time.Sleep(5 * time.Minute)
		k.cleanupOldEvents(ctx)

		for {
			select {
			case <-ctx.Done():
				k.log.Debug("Event cleanup stopped due to context cancellation")
				return
			case <-ticker.C:
				k.cleanupOldEvents(ctx)
			}
		}
	}()
}

// cleanupOldEvents performs the actual cleanup of old events
func (k *kvStorageBackend) cleanupOldEvents(ctx context.Context) {
	deletedCount, err := k.eventStore.CleanupOldEvents(ctx, k.eventRetentionPeriod)
	if err != nil {
		k.log.Error("Failed to cleanup old events", "error", err)
		return
	}

	if deletedCount > 0 {
		k.log.Debug("Cleaned up old events", "deleted_count", deletedCount, "retention_period", k.eventRetentionPeriod)
	}
}

func (k *kvStorageBackend) pruneEvents(ctx context.Context, key PruningKey) error {
	if !key.Validate() {
		return fmt.Errorf("invalid pruning key, all fields must be set: %+v", key)
	}

	keepEvents := make([]DataKey, 0, prunerMaxEvents)

	// iterate over all keys for the resource and delete versions beyond the latest 20
	for datakey, err := range k.dataStore.Keys(ctx, ListRequestKey(key)) {
		if err != nil {
			return err
		}

		if len(keepEvents) < prunerMaxEvents {
			keepEvents = append(keepEvents, datakey)
			continue
		}

		// If we already have 20 versions, delete the oldest one and append the new one
		err := k.dataStore.Delete(ctx, keepEvents[0])
		if err != nil {
			return err
		}
		keepEvents = append(keepEvents[1:], datakey)
	}

	return nil
}

func (k *kvStorageBackend) initPruner(ctx context.Context) error {
	if !k.withPruner {
		k.log.Debug("Pruner disabled, using noop pruner")
		k.historyPruner = &NoopPruner{}
		return nil
	}

	k.log.Debug("Initializing history pruner")
	pruner, err := debouncer.NewGroup(debouncer.DebouncerOpts[PruningKey]{
		Name:           "history_pruner",
		BufferSize:     1000,
		MinWait:        time.Second * 30,
		MaxWait:        time.Minute * 5,
		ProcessHandler: k.pruneEvents,
		ErrorHandler: func(key PruningKey, err error) {
			k.log.Error("failed to prune history",
				"namespace", key.Namespace,
				"group", key.Group,
				"resource", key.Resource,
				"name", key.Name,
				"error", err)
		},
	})
	if err != nil {
		return err
	}

	k.historyPruner = pruner
	k.historyPruner.Start(ctx)
	return nil
}

// WriteEvent writes a resource event (create/update/delete) to the storage backend.
func (k *kvStorageBackend) WriteEvent(ctx context.Context, event WriteEvent) (int64, error) {
	if err := event.Validate(); err != nil {
		return 0, fmt.Errorf("invalid event: %w", err)
	}
	rv := k.snowflake.Generate().Int64()

	obj := event.Object
	// Write data.
	var action DataAction
	switch event.Type {
	case resourcepb.WatchEvent_ADDED:
		action = DataActionCreated
		// Check if resource already exists for create operations
		_, err := k.metaStore.GetLatestResourceKey(ctx, MetaGetRequestKey{
			Namespace: event.Key.Namespace,
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Name:      event.Key.Name,
		})
		if err == nil {
			// Resource exists, return already exists error
			return 0, ErrResourceAlreadyExists
		}
		if !errors.Is(err, ErrNotFound) {
			// Some other error occurred
			return 0, fmt.Errorf("failed to check if resource exists: %w", err)
		}
	case resourcepb.WatchEvent_MODIFIED:
		action = DataActionUpdated
	case resourcepb.WatchEvent_DELETED:
		action = DataActionDeleted
		obj = event.ObjectOld
	default:
		return 0, fmt.Errorf("invalid event type: %d", event.Type)
	}

	if obj == nil {
		return 0, fmt.Errorf("object is nil")
	}

	// Build the search document
	doc, err := k.builder.BuildDocument(ctx, event.Key, rv, event.Value)
	if err != nil {
		return 0, fmt.Errorf("failed to build document: %w", err)
	}

	// Write the data
	err = k.dataStore.Save(ctx, DataKey{
		Namespace:       event.Key.Namespace,
		Group:           event.Key.Group,
		Resource:        event.Key.Resource,
		Name:            event.Key.Name,
		ResourceVersion: rv,
		Action:          action,
	}, bytes.NewReader(event.Value))
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
			Folder:          obj.GetFolder(),
		},
		Value: MetaData{
			IndexableDocument: *doc,
		},
	})
	if err != nil {
		return 0, fmt.Errorf("failed to write metadata: %w", err)
	}

	// Write event
	err = k.eventStore.Save(ctx, Event{
		Namespace:       event.Key.Namespace,
		Group:           event.Key.Group,
		Resource:        event.Key.Resource,
		Name:            event.Key.Name,
		ResourceVersion: rv,
		Action:          action,
		Folder:          obj.GetFolder(),
		PreviousRV:      event.PreviousRV,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to save event: %w", err)
	}

	_ = k.historyPruner.Add(PruningKey{
		Namespace: event.Key.Namespace,
		Group:     event.Key.Group,
		Resource:  event.Key.Resource,
		Name:      event.Key.Name,
	})

	return rv, nil
}

func (k *kvStorageBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	if req.Key == nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusBadRequest, Message: "missing key"}}
	}
	meta, err := k.metaStore.GetResourceKeyAtRevision(ctx, MetaGetRequestKey{
		Namespace: req.Key.Namespace,
		Group:     req.Key.Group,
		Resource:  req.Key.Resource,
		Name:      req.Key.Name,
	}, req.ResourceVersion)
	if errors.Is(err, ErrNotFound) {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusNotFound, Message: "not found"}}
	} else if err != nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: err.Error()}}
	}
	data, err := k.dataStore.Get(ctx, DataKey{
		Namespace:       req.Key.Namespace,
		Group:           req.Key.Group,
		Resource:        req.Key.Resource,
		Name:            req.Key.Name,
		ResourceVersion: meta.ResourceVersion,
		Action:          meta.Action,
	})
	if err != nil || data == nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: err.Error()}}
	}
	value, err := readAndClose(data)
	if err != nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: err.Error()}}
	}
	return &BackendReadResponse{
		Key:             req.Key,
		ResourceVersion: meta.ResourceVersion,
		Value:           value,
		Folder:          meta.Folder,
	}
}

// ListIterator returns an iterator for listing resources.
func (k *kvStorageBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
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

	// We set the listRV to the current time.
	listRV := k.snowflake.Generate().Int64()
	if resourceVersion > 0 {
		listRV = resourceVersion
	}

	// Fetch the latest objects
	keys := make([]MetaDataKey, 0, min(defaultListBufferSize, req.Limit+1))
	idx := 0
	for metaKey, err := range k.metaStore.ListResourceKeysAtRevision(ctx, MetaListRequestKey{
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
		keys = append(keys, metaKey)
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
		limit:        req.Limit + 1, // TODO: for now we need at least one more item. Fix the caller
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
	keys         []MetaDataKey
	currentIndex int
	dataStore    *dataStore
	listRV       int64
	offset       int64
	limit        int64

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

	if int64(i.currentIndex) >= i.limit {
		return false
	}

	i.rv, i.err = i.keys[i.currentIndex].ResourceVersion, nil

	data, err := i.dataStore.Get(i.ctx, DataKey{
		Namespace:       i.keys[i.currentIndex].Namespace,
		Group:           i.keys[i.currentIndex].Group,
		Resource:        i.keys[i.currentIndex].Resource,
		Name:            i.keys[i.currentIndex].Name,
		ResourceVersion: i.keys[i.currentIndex].ResourceVersion,
		Action:          i.keys[i.currentIndex].Action,
	})
	if err != nil {
		i.err = err
		return false
	}

	i.value, i.err = readAndClose(data)
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
	return i.keys[i.currentIndex].Namespace
}

func (i *kvListIterator) Name() string {
	return i.keys[i.currentIndex].Name
}

func (i *kvListIterator) Folder() string {
	return i.keys[i.currentIndex].Folder
}

func (i *kvListIterator) Value() []byte {
	return i.value
}

func validateListHistoryRequest(req *resourcepb.ListRequest) error {
	if req.Options == nil || req.Options.Key == nil {
		return fmt.Errorf("missing options or key in ListRequest")
	}
	key := req.Options.Key
	if key.Group == "" {
		return fmt.Errorf("group is required")
	}
	if key.Resource == "" {
		return fmt.Errorf("resource is required")
	}
	if key.Namespace == "" {
		return fmt.Errorf("namespace is required")
	}
	if key.Name == "" {
		return fmt.Errorf("name is required")
	}
	return nil
}

// filterHistoryKeysByVersion filters history keys based on version match criteria
func filterHistoryKeysByVersion(historyKeys []DataKey, req *resourcepb.ListRequest) ([]DataKey, error) {
	switch req.GetVersionMatchV2() {
	case resourcepb.ResourceVersionMatchV2_Exact:
		if req.ResourceVersion <= 0 {
			return nil, fmt.Errorf("expecting an explicit resource version query when using Exact matching")
		}
		var exactKeys []DataKey
		for _, key := range historyKeys {
			if key.ResourceVersion == req.ResourceVersion {
				exactKeys = append(exactKeys, key)
			}
		}
		return exactKeys, nil
	case resourcepb.ResourceVersionMatchV2_NotOlderThan:
		if req.ResourceVersion > 0 {
			var filteredKeys []DataKey
			for _, key := range historyKeys {
				if key.ResourceVersion >= req.ResourceVersion {
					filteredKeys = append(filteredKeys, key)
				}
			}
			return filteredKeys, nil
		}
	default:
		if req.ResourceVersion > 0 {
			var filteredKeys []DataKey
			for _, key := range historyKeys {
				if key.ResourceVersion <= req.ResourceVersion {
					filteredKeys = append(filteredKeys, key)
				}
			}
			return filteredKeys, nil
		}
	}
	return historyKeys, nil
}

// applyLiveHistoryFilter applies "live" history logic by ignoring events before the last delete
func applyLiveHistoryFilter(filteredKeys []DataKey, req *resourcepb.ListRequest) []DataKey {
	useLatestDeletionAsMinRV := req.ResourceVersion == 0 && req.Source != resourcepb.ListRequest_TRASH && req.GetVersionMatchV2() != resourcepb.ResourceVersionMatchV2_Exact
	if !useLatestDeletionAsMinRV {
		return filteredKeys
	}

	latestDeleteRV := int64(0)
	for _, key := range filteredKeys {
		if key.Action == DataActionDeleted && key.ResourceVersion > latestDeleteRV {
			latestDeleteRV = key.ResourceVersion
		}
	}
	if latestDeleteRV > 0 {
		var liveKeys []DataKey
		for _, key := range filteredKeys {
			if key.ResourceVersion > latestDeleteRV {
				liveKeys = append(liveKeys, key)
			}
		}
		return liveKeys
	}
	return filteredKeys
}

// sortByResourceVersion sorts the history keys based on the sortAscending flag
func sortByResourceVersion(filteredKeys []DataKey, sortAscending bool) {
	if sortAscending {
		sort.Slice(filteredKeys, func(i, j int) bool {
			return filteredKeys[i].ResourceVersion < filteredKeys[j].ResourceVersion
		})
	} else {
		sort.Slice(filteredKeys, func(i, j int) bool {
			return filteredKeys[i].ResourceVersion > filteredKeys[j].ResourceVersion
		})
	}
}

// applyPagination filters keys based on pagination parameters
func applyPagination(keys []DataKey, lastSeenRV int64, sortAscending bool) []DataKey {
	if lastSeenRV == 0 {
		return keys
	}

	var pagedKeys []DataKey
	for _, key := range keys {
		if sortAscending && key.ResourceVersion > lastSeenRV {
			pagedKeys = append(pagedKeys, key)
		} else if !sortAscending && key.ResourceVersion < lastSeenRV {
			pagedKeys = append(pagedKeys, key)
		}
	}
	return pagedKeys
}

func (k *kvStorageBackend) ListModifiedSince(ctx context.Context, key NamespacedResource, sinceRv int64) (int64, iter.Seq2[*ModifiedResource, error]) {
	if !key.Valid() {
		return 0, func(yield func(*ModifiedResource, error) bool) {
			yield(nil, fmt.Errorf("group, resource, and namespace are required"))
		}
	}

	if sinceRv <= 0 {
		return 0, func(yield func(*ModifiedResource, error) bool) {
			yield(nil, fmt.Errorf("sinceRv must be greater than 0"))
		}
	}

	// Generate a new resource version for the list
	listRV := k.snowflake.Generate().Int64()

	// Check if sinceRv is older than 1 hour
	sinceRvTimestamp := snowflake.ID(sinceRv).Time()
	sinceTime := time.Unix(0, sinceRvTimestamp*int64(time.Millisecond))
	sinceRvAge := time.Since(sinceTime)

	if sinceRvAge > time.Hour {
		k.log.Debug("ListModifiedSince using data store", "sinceRv", sinceRv, "sinceRvAge", sinceRvAge)
		return listRV, k.listModifiedSinceDataStore(ctx, key, sinceRv)
	}

	k.log.Debug("ListModifiedSince using event store", "sinceRv", sinceRv, "sinceRvAge", sinceRvAge)
	return listRV, k.listModifiedSinceEventStore(ctx, key, sinceRv)
}

func convertEventType(action DataAction) resourcepb.WatchEvent_Type {
	switch action {
	case DataActionCreated:
		return resourcepb.WatchEvent_ADDED
	case DataActionUpdated:
		return resourcepb.WatchEvent_MODIFIED
	case DataActionDeleted:
		return resourcepb.WatchEvent_DELETED
	default:
		panic(fmt.Sprintf("unknown DataAction: %v", action))
	}
}

func (k *kvStorageBackend) getValueFromDataStore(ctx context.Context, dataKey DataKey) ([]byte, error) {
	raw, err := k.dataStore.Get(ctx, dataKey)
	if err != nil {
		return []byte{}, err
	}

	value, err := io.ReadAll(raw)
	if err != nil {
		return []byte{}, err
	}

	return value, nil
}

func (k *kvStorageBackend) listModifiedSinceDataStore(ctx context.Context, key NamespacedResource, sinceRv int64) iter.Seq2[*ModifiedResource, error] {
	return func(yield func(*ModifiedResource, error) bool) {
		var lastSeenResource *ModifiedResource
		var lastSeenDataKey DataKey
		for dataKey, err := range k.dataStore.Keys(ctx, ListRequestKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}) {
			if err != nil {
				yield(&ModifiedResource{}, err)
				return
			}

			if dataKey.ResourceVersion < sinceRv {
				continue
			}

			if lastSeenResource == nil {
				lastSeenResource = &ModifiedResource{
					Key: resourcepb.ResourceKey{
						Namespace: dataKey.Namespace,
						Group:     dataKey.Group,
						Resource:  dataKey.Resource,
						Name:      dataKey.Name,
					},
					ResourceVersion: dataKey.ResourceVersion,
					Action:          convertEventType(dataKey.Action),
				}
				lastSeenDataKey = dataKey
			}

			if lastSeenResource.Key.Name != dataKey.Name {
				value, err := k.getValueFromDataStore(ctx, lastSeenDataKey)
				if err != nil {
					yield(&ModifiedResource{}, err)
					return
				}

				lastSeenResource.Value = value

				if !yield(lastSeenResource, nil) {
					return
				}
			}

			lastSeenResource = &ModifiedResource{
				Key: resourcepb.ResourceKey{
					Namespace: dataKey.Namespace,
					Group:     dataKey.Group,
					Resource:  dataKey.Resource,
					Name:      dataKey.Name,
				},
				ResourceVersion: dataKey.ResourceVersion,
				Action:          convertEventType(dataKey.Action),
			}
			lastSeenDataKey = dataKey
		}

		if lastSeenResource != nil {
			value, err := k.getValueFromDataStore(ctx, lastSeenDataKey)
			if err != nil {
				yield(&ModifiedResource{}, err)
				return
			}

			lastSeenResource.Value = value

			yield(lastSeenResource, nil)
		}
	}
}

func (k *kvStorageBackend) listModifiedSinceEventStore(ctx context.Context, key NamespacedResource, sinceRv int64) iter.Seq2[*ModifiedResource, error] {
	return func(yield func(*ModifiedResource, error) bool) {
		// store all events ordered by RV for the given tenant here
		eventKeys := make([]EventKey, 0)
		for evtKeyStr, err := range k.eventStore.ListKeysSince(ctx, sinceRv-defaultLookbackPeriod.Nanoseconds()) {
			if err != nil {
				yield(&ModifiedResource{}, err)
				return
			}

			evtKey, err := ParseEventKey(evtKeyStr)
			if err != nil {
				yield(&ModifiedResource{}, err)
				return
			}

			if evtKey.ResourceVersion < sinceRv {
				continue
			}

			if evtKey.Group != key.Group || evtKey.Resource != key.Resource || evtKey.Namespace != key.Namespace {
				continue
			}

			eventKeys = append(eventKeys, evtKey)
		}

		// we only care about the latest revision of every resource in the list
		seen := make(map[string]struct{})
		for i := len(eventKeys) - 1; i >= 0; i -= 1 {
			evtKey := eventKeys[i]
			if _, ok := seen[evtKey.Name]; ok {
				continue
			}
			seen[evtKey.Name] = struct{}{}

			value, err := k.getValueFromDataStore(ctx, DataKey(evtKey))
			if err != nil {
				yield(&ModifiedResource{}, err)
				return
			}

			if !yield(&ModifiedResource{
				Key: resourcepb.ResourceKey{
					Group:     evtKey.Group,
					Resource:  evtKey.Resource,
					Namespace: evtKey.Namespace,
					Name:      evtKey.Name,
				},
				Action:          convertEventType(evtKey.Action),
				ResourceVersion: evtKey.ResourceVersion,
				Value:           value,
			}, nil) {
				return
			}
		}
	}
}

// ListHistory is like ListIterator, but it returns the history of a resource.
func (k *kvStorageBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, fn func(ListIterator) error) (int64, error) {
	if err := validateListHistoryRequest(req); err != nil {
		return 0, err
	}
	key := req.Options.Key
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
	historyKeys := make([]DataKey, 0, min(defaultListBufferSize, req.Limit+1))

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
		historyKeys = append(historyKeys, dataKey)
	}

	// Check if context has been cancelled
	if ctx.Err() != nil {
		return 0, ctx.Err()
	}

	// Handle trash differently from regular history
	if req.Source == resourcepb.ListRequest_TRASH {
		return k.processTrashEntries(ctx, req, fn, historyKeys, lastSeenRV, sortAscending, listRV)
	}

	// Apply filtering based on version match
	filteredKeys, filterErr := filterHistoryKeysByVersion(historyKeys, req)
	if filterErr != nil {
		return 0, filterErr
	}

	// Apply "live" history logic: ignore events before the last delete
	filteredKeys = applyLiveHistoryFilter(filteredKeys, req)

	// Sort the entries if not already sorted correctly
	sortByResourceVersion(filteredKeys, sortAscending)

	// Pagination: filter out items up to and including lastSeenRV
	pagedKeys := applyPagination(filteredKeys, lastSeenRV, sortAscending)

	iter := kvHistoryIterator{
		keys:          pagedKeys,
		currentIndex:  -1,
		ctx:           ctx,
		listRV:        listRV,
		sortAscending: sortAscending,
		dataStore:     k.dataStore,
	}

	err := fn(&iter)
	if err != nil {
		return 0, err
	}

	return listRV, nil
}

// processTrashEntries handles the special case of listing deleted items (trash)
func (k *kvStorageBackend) processTrashEntries(ctx context.Context, req *resourcepb.ListRequest, fn func(ListIterator) error, historyKeys []DataKey, lastSeenRV int64, sortAscending bool, listRV int64) (int64, error) {
	// Filter to only deleted entries
	var deletedKeys []DataKey
	for _, key := range historyKeys {
		if key.Action == DataActionDeleted {
			deletedKeys = append(deletedKeys, key)
		}
	}

	// Check if the resource currently exists (is live)
	// If it exists, don't return any trash entries
	_, err := k.metaStore.GetLatestResourceKey(ctx, MetaGetRequestKey{
		Namespace: req.Options.Key.Namespace,
		Group:     req.Options.Key.Group,
		Resource:  req.Options.Key.Resource,
		Name:      req.Options.Key.Name,
	})

	var trashKeys []DataKey
	if errors.Is(err, ErrNotFound) {
		// Resource doesn't exist currently, so we can return the latest delete
		// Find the latest delete event
		var latestDelete *DataKey
		for _, key := range deletedKeys {
			if latestDelete == nil || key.ResourceVersion > latestDelete.ResourceVersion {
				latestDelete = &key
			}
		}
		if latestDelete != nil {
			trashKeys = append(trashKeys, *latestDelete)
		}
	}
	// If err != ErrNotFound, the resource exists, so no trash entries should be returned

	// Apply version filtering
	filteredKeys, err := filterHistoryKeysByVersion(trashKeys, req)
	if err != nil {
		return 0, err
	}

	// Sort the entries
	sortByResourceVersion(filteredKeys, sortAscending)

	// Pagination: filter out items up to and including lastSeenRV
	pagedKeys := applyPagination(filteredKeys, lastSeenRV, sortAscending)

	iter := kvHistoryIterator{
		keys:          pagedKeys,
		currentIndex:  -1,
		ctx:           ctx,
		listRV:        listRV,
		sortAscending: sortAscending,
		dataStore:     k.dataStore,
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
	keys          []DataKey
	currentIndex  int
	listRV        int64
	sortAscending bool
	dataStore     *dataStore

	// current
	rv     int64
	err    error
	value  []byte
	folder string
}

func (i *kvHistoryIterator) Next() bool {
	i.currentIndex++

	if i.currentIndex >= len(i.keys) {
		return false
	}

	key := i.keys[i.currentIndex]
	i.rv = key.ResourceVersion

	// Read the value from the ReadCloser
	data, err := i.dataStore.Get(i.ctx, key)
	if err != nil {
		i.err = err
		return false
	}
	if data == nil {
		i.err = fmt.Errorf("data is nil")
		return false
	}
	i.value, i.err = readAndClose(data)
	if i.err != nil {
		return false
	}

	// Extract the folder from the meta data
	partial := &metav1.PartialObjectMetadata{}
	err = json.Unmarshal(i.value, partial)
	if err != nil {
		i.err = err
		return false
	}

	meta, err := utils.MetaAccessor(partial)
	if err != nil {
		i.err = err
		return false
	}
	i.folder = meta.GetFolder()
	i.err = nil

	return true
}

func (i *kvHistoryIterator) Error() error {
	return i.err
}

func (i *kvHistoryIterator) ContinueToken() string {
	if i.currentIndex < 0 || i.currentIndex >= len(i.keys) {
		return ""
	}
	token := ContinueToken{
		StartOffset:     i.rv,
		ResourceVersion: i.keys[i.currentIndex].ResourceVersion,
		SortAscending:   i.sortAscending,
	}
	return token.String()
}

func (i *kvHistoryIterator) ResourceVersion() int64 {
	return i.rv
}

func (i *kvHistoryIterator) Namespace() string {
	if i.currentIndex >= 0 && i.currentIndex < len(i.keys) {
		return i.keys[i.currentIndex].Namespace
	}
	return ""
}

func (i *kvHistoryIterator) Name() string {
	if i.currentIndex >= 0 && i.currentIndex < len(i.keys) {
		return i.keys[i.currentIndex].Name
	}
	return ""
}

func (i *kvHistoryIterator) Folder() string {
	return i.folder
}

func (i *kvHistoryIterator) Value() []byte {
	return i.value
}

// WatchWriteEvents returns a channel that receives write events.
func (k *kvStorageBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	// Create a channel to receive events
	events := make(chan *WrittenEvent, 10000) // TODO: make this configurable

	notifierEvents := k.notifier.Watch(ctx, defaultWatchOptions())
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
			if err != nil || dataReader == nil {
				k.log.Error("failed to get data for event", "error", err)
				continue
			}
			data, err := readAndClose(dataReader)
			if err != nil {
				k.log.Error("failed to read and close data for event", "error", err)
				continue
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
func (k *kvStorageBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]ResourceStats, error) {
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

// readAndClose reads all data from a ReadCloser and ensures it's closed,
// combining any errors from both operations.
func readAndClose(r io.ReadCloser) ([]byte, error) {
	data, err := io.ReadAll(r)
	return data, errors.Join(err, r.Close())
}
