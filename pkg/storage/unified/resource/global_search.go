package resource

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// GlobalSearchFieldsHash fingerprints what a namespace-wide index contains: its
// field set and the resource types it covers. An existing index recording a
// different value is rebuilt.
//
// The field set has to be here: it decides the mapping, and the mapping is part
// of the stored index. The covered types are here only for now. Without them an
// index reused after a type is added would never hold that type's existing
// objects, and one reused after a type is dropped would keep serving them. A full
// rebuild is the wrong answer to a coverage change, though: adding one type to a
// long list should index only that type. This has to be replaced by syncing just
// the types that changed before the index is switched on by default.
func GlobalSearchFieldsHash() string {
	covered := make([]string, 0, len(GlobalSearchResourceTypes()))
	for _, gr := range GlobalSearchResourceTypes() {
		covered = append(covered, gr.String())
	}
	slices.Sort(covered)

	payload := struct {
		Fields  []hashableField `json:"f"`
		Covered []string        `json:"c"`
	}{
		Fields:  canonicalHashableFields(GlobalSearchFieldDefinitions()),
		Covered: covered,
	}

	blob, err := json.Marshal(payload)
	if err != nil {
		// Returning nothing disables the rebuild-on-change check, so the log line is
		// the only sign. See IndexAffectingHash for why this cannot happen today.
		searchFieldLogger.Error("failed to marshal the namespace-wide search fields for hashing", "err", err)
		return ""
	}
	sum := sha256.Sum256(blob)
	return hex.EncodeToString(sum[:])
}

func groupResourceOf(key NamespacedResource) schema.GroupResource {
	return schema.GroupResource{Group: key.Group, Resource: key.Resource}
}

// GlobalSearchResourceTypes lists the resource types a namespace-wide index
// covers.
//
// Written out for now. The list is meant to come from the manifests, with each
// kind opting in, which also gives the owner of a kind somewhere to say so.
// Until then it stays short and explicit, because adding a type means checking
// how its documents are authorized first.
func GlobalSearchResourceTypes() []schema.GroupResource {
	return []schema.GroupResource{
		{Group: "dashboard.grafana.app", Resource: "dashboards"},
		{Group: "folder.grafana.app", Resource: "folders"},
	}
}

// keepStandardFieldsOnly drops what a document carries for its own resource type,
// leaving the fields every resource has.
//
// A namespace-wide index declares no resource-specific fields, so these values
// would be built, handed over, and dropped by the index, once per document and
// with a warning each time.
func keepStandardFieldsOnly(doc *IndexableDocument) *IndexableDocument {
	if doc == nil {
		return nil
	}
	doc.Fields = nil
	doc.SelectableFields = nil
	return doc
}

// GlobalIndexCoversType reports whether a global index holds documents of this
// resource type.
func GlobalIndexCoversType(gr schema.GroupResource) bool {
	return slices.Contains(GlobalSearchResourceTypes(), gr)
}

// indexSources returns the resource types whose documents belong in the index
// for key. A namespace-wide index draws from every covered type; every other
// index draws from its own type only.
func indexSources(key NamespacedResource) []NamespacedResource {
	if !key.IsGlobal() {
		return []NamespacedResource{key}
	}
	types := GlobalSearchResourceTypes()
	out := make([]NamespacedResource, 0, len(types))
	for _, gr := range types {
		out = append(out, NamespacedResource{
			Namespace: key.Namespace,
			Group:     gr.Group,
			Resource:  gr.Resource,
		})
	}
	return out
}

// GlobalSearchFieldDefinitions returns the searchable fields of a
// namespace-wide index. It starts from the standard set, because such an index
// holds nothing resource-specific, and differs in two ways:
//
//   - The resource type of each document is filterable, so a query can pick out
//     one type from an index holding several.
//   - created and updated are filterable and sortable, so results of different
//     types can be ordered by time. The per-resource indexes cannot have this
//     yet: indexing those fields changes the index-affecting hash and would
//     rebuild every index in the deployment.
func GlobalSearchFieldDefinitions() []SearchFieldDefinition {
	standard := StandardSearchFieldDefinitions()
	out := make([]SearchFieldDefinition, 0, len(standard)+1)
	out = append(out, SearchFieldDefinition{
		Name: SEARCH_FIELD_GROUP_RESOURCE,
		Type: SearchFieldTypeString,
		// Faceted as well as filtered, so a caller can count how many hits each
		// resource type contributed without a query per type.
		Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityFacet},
		Description:  "Resource type of the document, as {group}/{resource}.",
	})
	for _, def := range standard {
		if def.Name == SEARCH_FIELD_CREATED || def.Name == SEARCH_FIELD_UPDATED {
			def.Capabilities = append(slices.Clone(def.Capabilities), SearchCapabilityFilter, SearchCapabilitySort)
		}
		out = append(out, def)
	}
	return out
}

// IndexFieldDefinitions returns the field sets an index declares beyond its own
// resource's fields: the standard fields, and the fields only a deleted document
// carries. A namespace-wide index has its own standard set and holds no deleted
// documents, so it declares no deleted-document fields.
func IndexFieldDefinitions(group, resource string) (standard, deleted []SearchFieldDefinition) {
	key := NamespacedResource{Group: group, Resource: resource}
	if key.IsGlobal() {
		return GlobalSearchFieldDefinitions(), nil
	}
	return StandardSearchFieldDefinitions(), TrashSearchFieldDefinitions()
}

// queueImportedTypeRebuilds queues a rebuild of the types each open global index
// has not caught up with since an import. An import replaces a type without
// announcing any change, so nothing else would notice. The rebuild queue bounds
// how many run at once and never overlaps a full rebuild of the same index.
//
// openIndexes is every open index, per-resource and global, as the rebuild scan
// lists them; only the global ones have imported types to catch up with.
func (s *searchServer) queueImportedTypeRebuilds(ctx context.Context, openIndexes []NamespacedResource) ([]chan struct{}, error) {
	var completeChs []chan struct{}
	var errs []error
	for _, key := range openIndexes {
		if !key.IsGlobal() {
			continue
		}
		idx := s.search.GetIndex(key)
		if idx == nil {
			continue
		}
		pending, err := s.importedSinceRecorded(ctx, key, idx, nil)
		if err != nil {
			errs = append(errs, fmt.Errorf("checking %s for imports: %w", key.String(), err))
			continue
		}
		if len(pending) == 0 {
			continue
		}
		types := make([]schema.GroupResource, 0, len(pending))
		for _, p := range pending {
			types = append(types, groupResourceOf(p.src))
		}
		completeCh := make(chan struct{})
		completeChs = append(completeChs, completeCh)
		s.rebuildQueue.Add(rebuildRequest{
			NamespacedResource: key,
			importedTypes:      types,
			completeChannels:   []chan<- struct{}{completeCh},
		})
		s.indexMetrics.RebuildQueueLength.Set(float64(s.rebuildQueue.Len()))
	}
	return completeChs, errors.Join(errs...)
}

// pendingImport is a covered type storage reports as imported at a time the
// index has not recorded.
type pendingImport struct {
	src        NamespacedResource
	importedAt time.Time
}

// importedSinceRecorded returns the covered types, limited to only when it is not
// empty, that storage reports as imported later than the index recorded. Only a
// newer import counts, the same as for a per-resource index, which is rebuilt when
// its build time is before the last import.
func (s *searchServer) importedSinceRecorded(ctx context.Context, key NamespacedResource, idx ResourceIndex, only []schema.GroupResource) ([]pendingImport, error) {
	recorded, err := idx.ImportTimes()
	if err != nil {
		return nil, err
	}
	var pending []pendingImport
	for _, src := range indexSources(key) {
		gr := groupResourceOf(src)
		if len(only) > 0 && !slices.Contains(only, gr) {
			continue
		}
		importedAt, err := s.storage.GetResourceLastImportTime(ctx, src)
		if err != nil {
			return nil, err
		}
		if !importedAt.After(recorded[gr]) {
			continue
		}
		pending = append(pending, pendingImport{src: src, importedAt: importedAt})
	}
	return pending, nil
}

// rebuildImportedTypes rebuilds the given types of a global index, or every
// covered type when none are given, that the index has not caught up with since
// an import, and records each once rebuilt. Each type is checked again first, so
// a request that waited behind a full rebuild does nothing.
func (s *searchServer) rebuildImportedTypes(ctx context.Context, key NamespacedResource, only []schema.GroupResource) error {
	idx := s.search.GetIndex(key)
	if idx == nil {
		return nil
	}
	// The import time is read before the rebuild, so an import that lands during
	// it is still seen as newer next time.
	pending, err := s.importedSinceRecorded(ctx, key, idx, only)
	if err != nil || len(pending) == 0 {
		return err
	}
	// The rebuild does not move the index's checkpoint, and a checkpoint from
	// before the import would replay changes the import undid, such as a delete
	// of an object it restored. Updating first moves it past the import.
	if _, err := idx.UpdateIndex(ctx); err != nil {
		return err
	}
	for _, p := range pending {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		res, err := s.rebuildResourceType(ctx, idx, key, p.src)
		if err != nil {
			return err
		}
		s.log.Info("rebuilt an imported type in the global search index", "namespace", key.Namespace, "resource", p.src.GroupResource(),
			"reindexed", res.Reindexed, "removed", res.Removed, "failed", res.Failed)
		// Recorded even when some objects could not be built, or a failure that
		// comes from the object would rebuild the type forever. Those objects are
		// removed, so a reconcile sees them missing and retries them. Read failures
		// return above, unrecorded, and are retried.
		if res.Failed > 0 {
			s.log.Warn("some objects of an imported type could not be indexed", "namespace", key.Namespace, "resource", p.src.GroupResource(), "failed", res.Failed)
		}
		if err := idx.RecordImportTime(groupResourceOf(p.src), p.importedAt); err != nil {
			return err
		}
	}
	return nil
}

// reconcileReadChunkSize bounds how many drifted objects are read at once.
const reconcileReadChunkSize = 50

// reconcileResourceType repairs one resource type in a global index by comparing it
// with storage, rather than replaying changes, so it fixes drift however it
// happened and costs one keys-only listing when nothing drifted.
//
// It relies on each object's version only increasing, which an import breaks;
// use rebuildResourceType after an import.
func (s *searchServer) reconcileResourceType(ctx context.Context, index ResourceIndex, key, src NamespacedResource) (repairResult, error) {
	if err := checkRepairTarget(key, src); err != nil {
		return repairResult{}, err
	}
	// Read the index before listing storage: otherwise a document created and
	// indexed after the listing looks deleted and is removed while live.
	//
	// Two narrower races remain, both repaired by the next reconcile: an older body
	// overwriting a newer write, and a document recreated after the listing being
	// removed. Closing them needs conditional writes, which the index lacks.
	gr := schema.GroupResource{Group: src.Group, Resource: src.Resource}
	indexed := map[string]int64{}
	for ref, err := range index.ListDocumentRefs(ctx, gr) {
		if err != nil {
			return repairResult{}, err
		}
		indexed[ref.Name] = ref.RV
	}

	stored, err := s.storedRefs(ctx, src)
	if err != nil {
		return repairResult{}, err
	}

	// Newer in the index than in the listing is left alone: the listing is older,
	// and a later change may already be indexed.
	var outdated []string
	for name, rv := range stored {
		if indexedRV, ok := indexed[name]; !ok || indexedRV < rv {
			outdated = append(outdated, name)
		}
	}
	// A delete the index never heard about looks like this.
	var removed []string
	for name := range indexed {
		if _, ok := stored[name]; !ok {
			removed = append(removed, name)
		}
	}
	// Sorted so a repair is reproducible, not in map order.
	slices.Sort(outdated)
	slices.Sort(removed)

	if err := s.removeFromIndex(index, src, removed); err != nil {
		return repairResult{}, err
	}
	result, err := s.reindex(ctx, index, src, outdated)
	result.Removed = len(removed)
	return result, err
}

// rebuildResourceType rewrites one resource type in a global index from storage,
// ignoring what the index holds. For after an import, which can restore objects at
// older versions, so comparing versions would leave them stale.
//
// Everything is written before anything is removed, so the type does not vanish
// from search while the rebuild runs. An object that fails to build is removed
// rather than kept, because its old document may describe what the import
// replaced.
func (s *searchServer) rebuildResourceType(ctx context.Context, index ResourceIndex, key, src NamespacedResource) (repairResult, error) {
	if err := checkRepairTarget(key, src); err != nil {
		return repairResult{}, err
	}

	// Before the listing, for the same reason as in reconcileResourceType.
	gr := schema.GroupResource{Group: src.Group, Resource: src.Resource}
	indexed := map[string]struct{}{}
	for ref, err := range index.ListDocumentRefs(ctx, gr) {
		if err != nil {
			return repairResult{}, err
		}
		indexed[ref.Name] = struct{}{}
	}

	builder, err := s.builders.get(ctx, src)
	if err != nil {
		return repairResult{}, err
	}
	logger := s.log.New("namespace", src.Namespace, "resource", src.GroupResource())

	var result repairResult
	written := map[string]struct{}{}
	_, err = s.storage.ListIterator(ctx, &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{Namespace: src.Namespace, Group: src.Group, Resource: src.Resource},
		},
	}, func(iter ListIterator) error {
		items := make([]*BulkIndexItem, 0, maxBatchSize)
		names := make([]string, 0, maxBatchSize)
		flush := func() error {
			if len(items) == 0 {
				return nil
			}
			if err := index.BulkIndex(&BulkIndexRequest{Items: items, Path: IndexPathUpdate}); err != nil {
				return err
			}
			for _, name := range names {
				written[name] = struct{}{}
			}
			result.Reindexed += len(items)
			items, names = items[:0], names[:0]
			return nil
		}

		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			docKey := &resourcepb.ResourceKey{Namespace: src.Namespace, Group: src.Group, Resource: src.Resource, Name: iter.Name()}
			doc, err := builder.BuildDocument(ctx, docKey, iter.ResourceVersion(), iter.Value())
			if err != nil {
				logger.Warn("failed to build a document while rebuilding a resource type", "key", SearchID(docKey), "error", err)
				result.Failed++
				continue
			}
			items = append(items, &BulkIndexItem{Action: ActionIndex, Doc: keepStandardFieldsOnly(doc)})
			names = append(names, iter.Name())
			if len(items) >= maxBatchSize {
				if err := flush(); err != nil {
					return err
				}
			}
		}
		if err := iter.Error(); err != nil {
			return err
		}
		return flush()
	})
	if err != nil {
		return result, err
	}

	var removed []string
	for name := range indexed {
		if _, ok := written[name]; !ok {
			removed = append(removed, name)
		}
	}
	slices.Sort(removed)
	if err := s.removeFromIndex(index, src, removed); err != nil {
		return result, err
	}
	result.Removed = len(removed)
	return result, nil
}

// checkRepairTarget refuses per-resource indexes: they keep deleted documents for
// trash, which comparing with live objects would remove.
func checkRepairTarget(key, src NamespacedResource) error {
	if !key.IsGlobal() {
		return fmt.Errorf("repairing a resource type is only supported for a global index, not %s", key.String())
	}
	if src.Namespace != key.Namespace {
		return fmt.Errorf("resource type %s is in another namespace than index %s", src.String(), key.String())
	}
	return nil
}

// repairResult is what a reconcile or rebuild changed.
type repairResult struct {
	Reindexed int
	Removed   int
	// Failed counts objects that could not be built, so a caller that needs the
	// type complete, as after an import, can retry.
	Failed int
}

// storedRefs lists names and versions without bodies, because it only decides
// which objects are worth reading.
func (s *searchServer) storedRefs(ctx context.Context, src NamespacedResource) (map[string]int64, error) {
	refs := map[string]int64{}
	_, err := s.storage.ListIterator(ctx, &resourcepb.ListRequest{
		KeysOnly: true,
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: src.Namespace,
				Group:     src.Group,
				Resource:  src.Resource,
			},
		},
	}, func(iter ListIterator) error {
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			refs[iter.Name()] = iter.ResourceVersion()
		}
		return iter.Error()
	})
	if err != nil {
		return nil, err
	}
	return refs, nil
}

// removeFromIndex deletes in batches, so removing a whole type is not one huge
// write.
func (s *searchServer) removeFromIndex(index ResourceIndex, src NamespacedResource, names []string) error {
	for chunk := range slices.Chunk(names, maxBatchSize) {
		items := make([]*BulkIndexItem, 0, len(chunk))
		for _, name := range chunk {
			items = append(items, &BulkIndexItem{
				Action: ActionDelete,
				Key: &resourcepb.ResourceKey{
					Namespace: src.Namespace,
					Group:     src.Group,
					Resource:  src.Resource,
					Name:      name,
				},
			})
		}
		if err := index.BulkIndex(&BulkIndexRequest{Items: items, Path: IndexPathUpdate}); err != nil {
			return err
		}
	}
	return nil
}

// reindex reads and writes the named objects. One that cannot be built is
// skipped, not fatal, so a bad object does not block the rest; it stays missing,
// so the next reconcile retries it.
//
// Reads go in small chunks, writes in full batches: each write is a separate
// index batch with its own fixed cost.
func (s *searchServer) reindex(ctx context.Context, index ResourceIndex, src NamespacedResource, names []string) (repairResult, error) {
	var result repairResult
	if len(names) == 0 {
		return result, nil
	}

	builder, err := s.builders.get(ctx, src)
	if err != nil {
		return result, err
	}
	logger := s.log.New("namespace", src.Namespace, "resource", src.GroupResource())

	items := make([]*BulkIndexItem, 0, maxBatchSize)
	flush := func() error {
		if len(items) == 0 {
			return nil
		}
		if err := index.BulkIndex(&BulkIndexRequest{Items: items, Path: IndexPathUpdate}); err != nil {
			return err
		}
		result.Reindexed += len(items)
		items = items[:0]
		return nil
	}

	// Requests are built a chunk at a time, so only the comparison scales with
	// the size of the type.
	for chunk := range slices.Chunk(names, reconcileReadChunkSize) {
		requests := make([]*resourcepb.ReadRequest, 0, len(chunk))
		for _, name := range chunk {
			requests = append(requests, &resourcepb.ReadRequest{
				Key: &resourcepb.ResourceKey{Namespace: src.Namespace, Group: src.Group, Resource: src.Resource, Name: name},
			})
		}

		for response := range readResourcesInChunks(ctx, s.storage, requests, reconcileReadChunkSize) {
			if ctx.Err() != nil {
				return result, ctx.Err()
			}
			if response.Error != nil {
				// Not found means deleted since the listing, or the revision was
				// pruned by a newer update, which the update path delivers.
				// Anything else is a storage failure, returned so the caller does
				// not think the type is repaired.
				if response.Error.Code != http.StatusNotFound {
					return result, GetError(response.Error)
				}
				logger.Debug("object deleted since the listing, skipping it", "error", response.Error.Message)
				continue
			}
			doc, err := builder.BuildDocument(ctx, response.Key, response.ResourceVersion, response.Value)
			if err != nil {
				logger.Warn("failed to build a document while reconciling", "key", SearchID(response.Key), "error", err)
				result.Failed++
				continue
			}
			items = append(items, &BulkIndexItem{Action: ActionIndex, Doc: keepStandardFieldsOnly(doc)})
			if len(items) >= maxBatchSize {
				if err := flush(); err != nil {
					return result, err
				}
			}
		}
	}
	return result, flush()
}

// watchRetryDelay is how long to wait before asking storage for a new
// notification stream after one ends unexpectedly.
const watchRetryDelay = 5 * time.Second

// maxWatchBatch is how many notifications are taken at once. Notifications
// arrive one at a time, so a busy instance would otherwise update once per
// changed object.
const maxWatchBatch = 100

// runGlobalIndexWatch updates a global index when a write notification for it
// arrives. Searches on a global index do not wait for an update, so without this
// a change would appear only at the next background update.
//
// A notification only says that an index is behind; the update reads the change
// from storage, as every other update does. Writing the notification into the
// index instead would race with those updates, and a late notification could
// overwrite a newer document.
//
// Notifications are the fast path, not the reliable one: a dropped or missed
// one is picked up by the background update, so a failure here is logged and
// the stream is reopened rather than escalated.
func (s *searchServer) runGlobalIndexWatch(ctx context.Context) {
	for ctx.Err() == nil {
		events, err := s.storage.WatchWriteEvents(ctx)
		if err != nil {
			s.log.Warn("failed to watch write events for global search indexes", "error", err)
		} else {
			s.consumeWriteEvents(ctx, events)
		}

		// The stream ended. Wait before reopening so a backend that keeps failing
		// is not asked in a tight loop.
		select {
		case <-ctx.Done():
			return
		case <-time.After(watchRetryDelay):
		}
	}
}

// consumeWriteEvents applies notifications until the stream ends.
func (s *searchServer) consumeWriteEvents(ctx context.Context, events <-chan *WrittenEvent) {
	for {
		batch, ok := nextWriteEventBatch(ctx, events)
		if !ok {
			return
		}
		if ctx.Err() != nil {
			return
		}
		s.applyWriteEvents(ctx, batch)
	}
}

// nextWriteEventBatch blocks for one notification, then takes whatever else has
// already arrived. It reports false once the stream is closed.
func nextWriteEventBatch(ctx context.Context, events <-chan *WrittenEvent) ([]*WrittenEvent, bool) {
	// Also on the context: a stream that never sends, as some backends return,
	// would otherwise hold up shutdown.
	var first *WrittenEvent
	select {
	case <-ctx.Done():
		return nil, false
	case event, ok := <-events:
		if !ok {
			return nil, false
		}
		first = event
	}
	batch := make([]*WrittenEvent, 0, maxWatchBatch)
	batch = append(batch, first)
	for len(batch) < maxWatchBatch {
		select {
		case event, ok := <-events:
			if !ok {
				return batch, true
			}
			batch = append(batch, event)
		default:
			return batch, true
		}
	}
	return batch, true
}

// applyWriteEvents updates each global index a batch of notifications is for,
// once however many of them it got. Notifications for types the index does not
// cover, and for indexes this instance does not own or has not opened, are
// ignored: an index that is not open is brought up to date when it is opened.
func (s *searchServer) applyWriteEvents(ctx context.Context, batch []*WrittenEvent) {
	var keys []NamespacedResource
	for _, event := range batch {
		if event == nil || event.Key == nil {
			continue
		}
		if !GlobalIndexCoversType(schema.GroupResource{Group: event.Key.Group, Resource: event.Key.Resource}) {
			continue
		}
		if key := GlobalSearchKey(event.Key.Namespace); !slices.Contains(keys, key) {
			keys = append(keys, key)
		}
	}

	for _, key := range keys {
		if ctx.Err() != nil {
			return
		}
		if !s.ownsGlobalIndex(key) {
			continue
		}
		idx := s.search.GetIndex(key)
		if idx == nil {
			continue
		}
		if _, err := idx.UpdateIndex(ctx); err != nil {
			// The background update picks up whatever this missed.
			s.log.Warn("failed to update the global search index for write notifications", "namespace", key.Namespace, "error", err)
		}
	}
}

// ownsGlobalIndex reports whether this instance owns a global index. The
// background work skips one it does not own: fetching an index counts as using
// it, and would keep an index another instance now owns from ever being closed
// here.
func (s *searchServer) ownsGlobalIndex(key NamespacedResource) bool {
	owned, err := s.ownsIndexFn(key)
	if err != nil {
		// Kept up to date rather than left to go stale: the check failing says
		// nothing about who owns it.
		s.log.Warn("failed to check global search index ownership", "namespace", key.Namespace, "error", err)
		return true
	}
	return owned
}
