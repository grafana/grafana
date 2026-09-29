package resource

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"

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

// syncReadChunkSize bounds how many drifted objects a sync reads at once.
const syncReadChunkSize = 50

// syncResourceType repairs one resource type in a global index by comparing it
// with storage, rather than replaying changes, so it fixes drift however it
// happened and costs one keys-only listing when nothing drifted.
//
// It relies on each object's version only increasing, which an import breaks;
// use resyncResourceType after an import.
func (s *searchServer) syncResourceType(ctx context.Context, index ResourceIndex, key, src NamespacedResource) (syncResult, error) {
	if err := checkSyncTarget(key, src); err != nil {
		return syncResult{}, err
	}
	// Read the index before listing storage: otherwise a document created and
	// indexed after the listing looks deleted and is removed while live.
	//
	// Two narrower races remain, both repaired by the next sync: an older body
	// overwriting a newer write, and a document recreated after the listing being
	// removed. Closing them needs conditional writes, which the index lacks.
	gr := schema.GroupResource{Group: src.Group, Resource: src.Resource}
	indexed := map[string]int64{}
	for ref, err := range index.ListDocumentRefs(ctx, gr) {
		if err != nil {
			return syncResult{}, err
		}
		indexed[ref.Name] = ref.RV
	}

	stored, err := s.storedRefs(ctx, src)
	if err != nil {
		return syncResult{}, err
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
		return syncResult{}, err
	}
	result, err := s.reindex(ctx, index, src, outdated)
	result.Removed = len(removed)
	return result, err
}

// resyncResourceType rewrites one resource type in a global index from storage,
// ignoring what the index holds. For after an import, which can restore objects at
// older versions, so comparing versions would leave them stale.
//
// Everything is written before anything is removed, so the type does not vanish
// from search while the resync runs. An object that fails to build is removed
// rather than kept, because its old document may describe what the import
// replaced.
func (s *searchServer) resyncResourceType(ctx context.Context, index ResourceIndex, key, src NamespacedResource) (syncResult, error) {
	if err := checkSyncTarget(key, src); err != nil {
		return syncResult{}, err
	}

	// Before the listing, for the same reason as in syncResourceType.
	gr := schema.GroupResource{Group: src.Group, Resource: src.Resource}
	indexed := map[string]struct{}{}
	for ref, err := range index.ListDocumentRefs(ctx, gr) {
		if err != nil {
			return syncResult{}, err
		}
		indexed[ref.Name] = struct{}{}
	}

	builder, err := s.builders.get(ctx, src)
	if err != nil {
		return syncResult{}, err
	}
	logger := s.log.New("namespace", src.Namespace, "resource", src.GroupResource())

	var result syncResult
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
				logger.Warn("failed to build a document while resyncing", "key", SearchID(docKey), "error", err)
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

// checkSyncTarget refuses per-resource indexes: they keep deleted documents for
// trash, which comparing with live objects would remove.
func checkSyncTarget(key, src NamespacedResource) error {
	if !key.IsGlobal() {
		return fmt.Errorf("syncing a resource type is only supported for a global index, not %s", key.String())
	}
	if src.Namespace != key.Namespace {
		return fmt.Errorf("resource type %s is in another namespace than index %s", src.String(), key.String())
	}
	return nil
}

// syncResult is what a sync changed.
type syncResult struct {
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
// so the next sync retries it.
//
// Reads go in small chunks, writes in full batches: each write is a separate
// index batch with its own fixed cost.
func (s *searchServer) reindex(ctx context.Context, index ResourceIndex, src NamespacedResource, names []string) (syncResult, error) {
	var result syncResult
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
	for chunk := range slices.Chunk(names, syncReadChunkSize) {
		requests := make([]*resourcepb.ReadRequest, 0, len(chunk))
		for _, name := range chunk {
			requests = append(requests, &resourcepb.ReadRequest{
				Key: &resourcepb.ResourceKey{Namespace: src.Namespace, Group: src.Group, Resource: src.Resource, Name: name},
			})
		}

		for response := range readResourcesInChunks(ctx, s.storage, requests, syncReadChunkSize) {
			if ctx.Err() != nil {
				return result, ctx.Err()
			}
			if response.Error != nil {
				// Not found means deleted since the listing. Anything else is a
				// storage failure, returned so the caller does not think the type
				// is in sync.
				if response.Error.Code != http.StatusNotFound {
					return result, GetError(response.Error)
				}
				logger.Debug("object deleted since the listing, skipping it", "error", response.Error.Message)
				continue
			}
			doc, err := builder.BuildDocument(ctx, response.Key, response.ResourceVersion, response.Value)
			if err != nil {
				logger.Warn("failed to build a document while syncing", "key", SearchID(response.Key), "error", err)
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
