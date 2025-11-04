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
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/debouncer"
)

const (
	defaultListBufferSize       = 100
	prunerMaxEvents             = 20
	defaultEventRetentionPeriod = 1 * time.Hour
	defaultEventPruningInterval = 5 * time.Minute
	clusterScopeNamespace       = "__cluster__"
)

// convertClusterNamespaceToEmpty converts the internal __cluster__ namespace back to empty string
// for cluster-scoped resources when returning to users
func convertClusterNamespaceToEmpty(namespace string) string {
	if namespace == clusterScopeNamespace {
		return ""
	}
	return namespace
}

// convertEmptyToClusterNamespace converts empty namespace to the internal __cluster__ namespace
// for cluster-scoped resources when WithExperimentalClusterScope is enabled
func convertEmptyToClusterNamespace(namespace string, withExperimentalClusterScope bool) string {
	if withExperimentalClusterScope && namespace == "" {
		return clusterScopeNamespace
	}
	return namespace
}

// kvStorageBackend Unified storage backend based on KV storage.
type kvStorageBackend struct {
	snowflake                    *snowflake.Node
	kv                           KV
	dataStore                    *dataStore
	eventStore                   *eventStore
	notifier                     *notifier
	builder                      DocumentBuilder
	log                          logging.Logger
	withPruner                   bool
	eventRetentionPeriod         time.Duration
	eventPruningInterval         time.Duration
	historyPruner                Pruner
	withExperimentalClusterScope bool
	//tracer        trace.Tracer
	//reg           prometheus.Registerer
}

var _ StorageBackend = &kvStorageBackend{}

type KVBackendOptions struct {
	KvStore                      KV
	WithPruner                   bool
	WithExperimentalClusterScope bool                  // Allow empty namespace to be used for cluster-scoped resources.
	EventRetentionPeriod         time.Duration         // How long to keep events (default: 1 hour)
	EventPruningInterval         time.Duration         // How often to run the event pruning (default: 5 minutes)
	Tracer                       trace.Tracer          // TODO add tracing
	Reg                          prometheus.Registerer // TODO add metrics
}

func NewKVStorageBackend(opts KVBackendOptions) (StorageBackend, error) {
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

	eventPruningInterval := opts.EventPruningInterval
	if eventPruningInterval <= 0 {
		eventPruningInterval = defaultEventPruningInterval
	}

	backend := &kvStorageBackend{
		kv:                           kv,
		dataStore:                    newDataStore(kv),
		eventStore:                   eventStore,
		notifier:                     newNotifier(eventStore, notifierOptions{}),
		snowflake:                    s,
		builder:                      StandardDocumentBuilder(), // For now we use the standard document builder.
		log:                          &logging.NoOpLogger{},     // Make this configurable
		eventRetentionPeriod:         eventRetentionPeriod,
		eventPruningInterval:         eventPruningInterval,
		withExperimentalClusterScope: opts.WithExperimentalClusterScope,
	}
	err = backend.initPruner(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize pruner: %w", err)
	}

	// Start the event cleanup background job
	go backend.runCleanupOldEvents(ctx)

	return backend, nil
}

// runCleanupOldEvents starts a background goroutine that periodically cleans up old events
func (k *kvStorageBackend) runCleanupOldEvents(ctx context.Context) {
	// Run cleanup every hour
	ticker := time.NewTicker(k.eventPruningInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			k.log.Debug("Event cleanup stopped due to context cancellation")
			return
		case <-ticker.C:
			k.cleanupOldEvents(ctx)
		}
	}
}

// cleanupOldEvents performs the actual cleanup of old events
func (k *kvStorageBackend) cleanupOldEvents(ctx context.Context) {
	cutoff := time.Now().Add(-k.eventRetentionPeriod)
	deletedCount, err := k.eventStore.CleanupOldEvents(ctx, cutoff)
	if err != nil {
		k.log.Error("Failed to cleanup old events", "error", err)
		return
	}

	if deletedCount == 0 {
		k.log.Info("Cleaned up old events", "deleted_count", deletedCount, "retention_period", k.eventRetentionPeriod)
	}
}

func (k *kvStorageBackend) pruneEvents(ctx context.Context, key PruningKey) error {
	if !key.Validate() {
		return fmt.Errorf("invalid pruning key, all fields must be set: %+v", key)
	}

	counter := 0
	// iterate over all keys for the resource and delete versions beyond the latest 20
	for datakey, err := range k.dataStore.Keys(ctx, ListRequestKey{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
		Name:      key.Name,
	}, SortOrderDesc) {
		if err != nil {
			return err
		}

		// Pruner needs to exclude deleted events
		if counter < prunerMaxEvents && datakey.Action != DataActionDeleted {
			counter++
			continue
		}

		// If we already have 20 versions, delete any more create or update events
		if datakey.Action != DataActionDeleted {
			err := k.dataStore.Delete(ctx, datakey)
			if err != nil {
				return err
			}
		}
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

	namespace := convertEmptyToClusterNamespace(event.Key.Namespace, k.withExperimentalClusterScope)

	obj := event.Object
	// Write data.
	var action DataAction
	switch event.Type {
	case resourcepb.WatchEvent_ADDED:
		action = DataActionCreated
		// Check if resource already exists for create operations
		_, err := k.dataStore.GetLatestResourceKey(ctx, GetRequestKey{
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Namespace: namespace,
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

	// Write the data
	err := k.dataStore.Save(ctx, DataKey{
		Group:           event.Key.Group,
		Resource:        event.Key.Resource,
		Namespace:       namespace,
		Name:            event.Key.Name,
		ResourceVersion: rv,
		Action:          action,
		Folder:          obj.GetFolder(),
	}, bytes.NewReader(event.Value))
	if err != nil {
		return 0, fmt.Errorf("failed to write data: %w", err)
	}

	// Write event
	err = k.eventStore.Save(ctx, Event{
		Namespace:       namespace,
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
		Namespace: namespace,
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

	namespace := convertEmptyToClusterNamespace(req.Key.Namespace, k.withExperimentalClusterScope)

	// If a specific resource version is requested, validate that it's not too high
	if req.ResourceVersion > 0 {
		// Fetch the latest RV
		latestRV := k.snowflake.Generate().Int64()
		if lastEventKey, err := k.eventStore.LastEventKey(ctx); err == nil {
			latestRV = lastEventKey.ResourceVersion
		} else if !errors.Is(err, ErrNotFound) {
			return &BackendReadResponse{Error: &resourcepb.ErrorResult{
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to fetch latest resource version: %v", err),
			}}
		}

		// Check if the requested RV is higher than the latest available RV
		if req.ResourceVersion > latestRV {
			return &BackendReadResponse{
				Error: &resourcepb.ErrorResult{
					Code:    http.StatusGatewayTimeout,
					Reason:  string(metav1.StatusReasonTimeout), // match etcd behavior
					Message: "ResourceVersion is larger than max",
					Details: &resourcepb.ErrorDetails{
						Causes: []*resourcepb.ErrorCause{
							{
								Reason:  string(metav1.CauseTypeResourceVersionTooLarge),
								Message: fmt.Sprintf("requested: %d, current %d", req.ResourceVersion, latestRV),
							},
						},
					},
				},
			}
		}
	}

	meta, err := k.dataStore.GetResourceKeyAtRevision(ctx, GetRequestKey{
		Group:     req.Key.Group,
		Resource:  req.Key.Resource,
		Namespace: namespace,
		Name:      req.Key.Name,
	}, req.ResourceVersion)
	if errors.Is(err, ErrNotFound) {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusNotFound, Message: "not found"}}
	} else if err != nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: err.Error()}}
	}
	data, err := k.dataStore.Get(ctx, DataKey{
		Group:           req.Key.Group,
		Resource:        req.Key.Resource,
		Namespace:       namespace,
		Name:            req.Key.Name,
		ResourceVersion: meta.ResourceVersion,
		Action:          meta.Action,
		Folder:          meta.Folder,
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

	namespace := convertEmptyToClusterNamespace(req.Options.Key.Namespace, k.withExperimentalClusterScope)

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

	// We set the listRV to the last event resource version.
	// If no events exist yet, we generate a new snowflake.
	listRV := k.snowflake.Generate().Int64()
	if lastEventKey, err := k.eventStore.LastEventKey(ctx); err == nil {
		listRV = lastEventKey.ResourceVersion
	} else if !errors.Is(err, ErrNotFound) {
		return 0, fmt.Errorf("failed to fetch last event: %w", err)
	}

	if resourceVersion > 0 {
		listRV = resourceVersion
	}

	// Fetch the latest objects
	keys := make([]DataKey, 0, min(defaultListBufferSize, req.Limit+1))
	idx := 0
	for dataKey, err := range k.dataStore.ListResourceKeysAtRevision(ctx, ListRequestKey{
		Group:     req.Options.Key.Group,
		Resource:  req.Options.Key.Resource,
		Namespace: namespace,
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
		keys = append(keys, dataKey)
		// Only fetch the first limit items + 1 to get the next token.
		if req.Limit > 0 && len(keys) >= int(req.Limit+1) {
			break
		}
	}
	// Create pull-style iterator from BatchGet
	next, stop := iter.Pull2(k.dataStore.BatchGet(ctx, keys))
	defer stop()

	iter := kvListIterator{
		listRV: listRV,
		offset: offset,
		next:   next,
	}
	err := cb(&iter)
	if err != nil {
		return 0, err
	}

	return listRV, nil
}

// kvListIterator implements ListIterator for KV storage
type kvListIterator struct {
	listRV int64
	offset int64

	// pull-style iterator
	next func() (DataObj, error, bool)

	// current item state
	currentDataObj *DataObj
	value          []byte
	err            error
}

func (i *kvListIterator) Next() bool {
	// Pull next item from the iterator
	dataObj, err, ok := i.next()
	if !ok {
		return false
	}
	if err != nil {
		i.err = err
		return false
	}

	i.currentDataObj = &dataObj

	i.value, err = readAndClose(dataObj.Value)
	if err != nil {
		i.err = err
		return false
	}

	i.offset++

	return true
}

func (i *kvListIterator) Error() error {
	return i.err
}

func (i *kvListIterator) ContinueToken() string {
	return ContinueToken{
		StartOffset:     i.offset,
		ResourceVersion: i.listRV,
	}.String()
}

func (i *kvListIterator) ResourceVersion() int64 {
	if i.currentDataObj != nil {
		return i.currentDataObj.Key.ResourceVersion
	}
	return 0
}

func (i *kvListIterator) Namespace() string {
	if i.currentDataObj != nil {
		return convertClusterNamespaceToEmpty(i.currentDataObj.Key.Namespace)
	}
	return ""
}

func (i *kvListIterator) Name() string {
	if i.currentDataObj != nil {
		return i.currentDataObj.Key.Name
	}
	return ""
}

func (i *kvListIterator) Folder() string {
	if i.currentDataObj != nil {
		return i.currentDataObj.Key.Folder
	}
	return ""
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
		exactKeys := make([]DataKey, 0, len(historyKeys))
		for _, key := range historyKeys {
			if key.ResourceVersion == req.ResourceVersion {
				exactKeys = append(exactKeys, key)
			}
		}
		return exactKeys, nil
	case resourcepb.ResourceVersionMatchV2_NotOlderThan:
		if req.ResourceVersion > 0 {
			filteredKeys := make([]DataKey, 0, len(historyKeys))
			for _, key := range historyKeys {
				if key.ResourceVersion >= req.ResourceVersion {
					filteredKeys = append(filteredKeys, key)
				}
			}
			return filteredKeys, nil
		}
	default:
		if req.ResourceVersion > 0 {
			filteredKeys := make([]DataKey, 0, len(historyKeys))
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
		liveKeys := make([]DataKey, 0, len(filteredKeys))
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

	pagedKeys := make([]DataKey, 0, len(keys))
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
		for dataKey, err := range k.dataStore.Keys(ctx, ListRequestKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}, SortOrderAsc) {
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
		for evtKeyStr, err := range k.eventStore.ListKeysSince(ctx, subtractDurationFromSnowflake(sinceRv, defaultLookbackPeriod)) {
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
	}, SortOrderAsc) {
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

	// Create pull-style iterator from BatchGet
	next, stop := iter.Pull2(k.dataStore.BatchGet(ctx, pagedKeys))
	defer stop()

	iter := kvHistoryIterator{
		listRV:        listRV,
		sortAscending: sortAscending,
		next:          next,
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
	deletedKeys := make([]DataKey, 0, len(historyKeys))
	for _, key := range historyKeys {
		if key.Action == DataActionDeleted {
			deletedKeys = append(deletedKeys, key)
		}
	}

	// Check if the resource currently exists (is live)
	// If it exists, don't return any trash entries
	_, err := k.dataStore.GetLatestResourceKey(ctx, GetRequestKey{
		Group:     req.Options.Key.Group,
		Resource:  req.Options.Key.Resource,
		Namespace: req.Options.Key.Namespace,
		Name:      req.Options.Key.Name,
	})

	trashKeys := make([]DataKey, 0, 1)
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

	// Create pull-style iterator from BatchGet
	next, stop := iter.Pull2(k.dataStore.BatchGet(ctx, pagedKeys))
	defer stop()

	iter := kvHistoryIterator{
		listRV:          listRV,
		sortAscending:   sortAscending,
		skipProvisioned: true,
		next:            next,
	}

	err = fn(&iter)
	if err != nil {
		return 0, err
	}

	return listRV, nil
}

// kvHistoryIterator implements ListIterator for KV storage history
type kvHistoryIterator struct {
	listRV          int64
	sortAscending   bool
	skipProvisioned bool

	// pull-style iterator
	next func() (DataObj, error, bool)

	// current item state
	currentDataObj *DataObj
	value          []byte
	folder         string
	err            error
}

func (i *kvHistoryIterator) Next() bool {
	// Pull next item from the iterator
	dataObj, err, ok := i.next()
	if !ok {
		return false
	}
	if err != nil {
		i.err = err
		return false
	}

	i.currentDataObj = &dataObj

	i.value, err = readAndClose(dataObj.Value)
	if err != nil {
		i.err = err
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

	// if the resource is provisioned and we are skipping provisioned resources, continue onto the next one
	if i.skipProvisioned && meta.GetAnnotation(utils.AnnoKeyManagerKind) != "" {
		return i.Next()
	}

	return true
}

func (i *kvHistoryIterator) Error() error {
	return i.err
}

func (i *kvHistoryIterator) ContinueToken() string {
	if i.currentDataObj == nil {
		return ""
	}
	rv := i.currentDataObj.Key.ResourceVersion
	token := ContinueToken{
		StartOffset:     rv,
		ResourceVersion: rv,
		SortAscending:   i.sortAscending,
	}
	return token.String()
}

func (i *kvHistoryIterator) ResourceVersion() int64 {
	if i.currentDataObj != nil {
		return i.currentDataObj.Key.ResourceVersion
	}
	return 0
}

func (i *kvHistoryIterator) Namespace() string {
	if i.currentDataObj != nil {
		return i.currentDataObj.Key.Namespace
	}
	return ""
}

func (i *kvHistoryIterator) Name() string {
	if i.currentDataObj != nil {
		return i.currentDataObj.Key.Name
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
				Group:           event.Group,
				Resource:        event.Resource,
				Namespace:       event.Namespace,
				Name:            event.Name,
				ResourceVersion: event.ResourceVersion,
				Action:          event.Action,
				Folder:          event.Folder,
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
					Namespace: convertClusterNamespaceToEmpty(event.Namespace),
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
func (k *kvStorageBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]ResourceStats, error) {
	return k.dataStore.GetResourceStats(ctx, namespace, minCount)
}

func (k *kvStorageBackend) GetResourceLastImportTimes(ctx context.Context) iter.Seq2[ResourceLastImportTime, error] {
	return func(yield func(ResourceLastImportTime, error) bool) {
		yield(ResourceLastImportTime{}, fmt.Errorf("not implemented"))
	}
}

// readAndClose reads all data from a ReadCloser and ensures it's closed,
// combining any errors from both operations.
func readAndClose(r io.ReadCloser) ([]byte, error) {
	data, err := io.ReadAll(r)
	return data, errors.Join(err, r.Close())
}
