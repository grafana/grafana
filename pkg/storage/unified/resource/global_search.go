package resource

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"iter"
	"maps"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// GlobalSearchFieldsHash fingerprints the field set of a namespace-wide index,
// which decides its mapping. An existing index recording a different value is
// rebuilt.
//
// The covered types are not part of it: the index records which types it holds,
// and the rebuild scan adds or removes only the types that changed.
func GlobalSearchFieldsHash() string {
	payload := struct {
		Fields []hashableField `json:"f"`
	}{
		Fields: canonicalHashableFields(GlobalSearchFieldDefinitions()),
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

// GlobalSearchResourceTypes lists, sorted, the resource types a namespace-wide
// index covers according to the manifests compiled into this binary. A search
// server also reads manifests at runtime, and uses GlobalSearchCoverageRegistry
// instead.
func GlobalSearchResourceTypes() []schema.GroupResource {
	return slices.Clone(globalSearchCoverage().types)
}

// GlobalSearchKinds names the Kubernetes kind of each covered resource type,
// which a result reports and which its group and resource do not say.
func GlobalSearchKinds() map[schema.GroupResource]string {
	return maps.Clone(globalSearchCoverage().kinds)
}

// namespacedScope is the manifest's spelling for a kind that lives in a
// namespace. A global index holds one namespace, so it covers only such kinds.
const namespacedScope = "Namespaced"

type globalSearchTypes struct {
	types []schema.GroupResource
	kinds map[schema.GroupResource]string
}

// globalSearchCoverage is worked out once, from every manifest compiled in, on
// first use: after the init functions that register manifests have run.
var globalSearchCoverage = sync.OnceValue(func() globalSearchTypes {
	return globalSearchCoverageOf(AppManifests())
})

// GlobalSearchCoverageRegistry holds the resource types one search server's
// global indexes cover, which change when it reloads its manifests. Its methods
// accept a nil registry and then answer from the compiled-in manifests.
type GlobalSearchCoverageRegistry struct {
	mu       sync.RWMutex
	coverage globalSearchTypes
	// changed is closed, and replaced, when the coverage changes.
	changed chan struct{}
}

func NewGlobalSearchCoverageRegistry(builtin []*app.ManifestData) *GlobalSearchCoverageRegistry {
	return &GlobalSearchCoverageRegistry{coverage: globalSearchCoverageOf(builtin), changed: make(chan struct{})}
}

// Reload replaces the coverage from the given manifests, with later sources
// winning, and returns the types added and dropped.
func (r *GlobalSearchCoverageRegistry) Reload(sources ...[]*app.ManifestData) (added, dropped []schema.GroupResource) {
	next := globalSearchCoverageOf(sources...)
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, gr := range next.types {
		if _, ok := r.coverage.kinds[gr]; !ok {
			added = append(added, gr)
		}
	}
	for _, gr := range r.coverage.types {
		if _, ok := next.kinds[gr]; !ok {
			dropped = append(dropped, gr)
		}
	}
	r.coverage = next
	if len(added) > 0 || len(dropped) > 0 {
		close(r.changed)
		r.changed = make(chan struct{})
	}
	return added, dropped
}

// Types lists the covered resource types, sorted.
func (r *GlobalSearchCoverageRegistry) Types() []schema.GroupResource {
	if r == nil {
		return GlobalSearchResourceTypes()
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return slices.Clone(r.coverage.types)
}

// Snapshot returns the covered resource types, sorted, and the Kubernetes kind
// of each, read together.
func (r *GlobalSearchCoverageRegistry) Snapshot() ([]schema.GroupResource, map[schema.GroupResource]string) {
	if r == nil {
		return GlobalSearchResourceTypes(), GlobalSearchKinds()
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return slices.Clone(r.coverage.types), maps.Clone(r.coverage.kinds)
}

// Covers reports whether global indexes hold documents of this resource type.
func (r *GlobalSearchCoverageRegistry) Covers(gr schema.GroupResource) bool {
	if r == nil {
		return GlobalIndexCoversType(gr)
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.coverage.kinds[gr]
	return ok
}

// Changed returns a channel closed at the next change of the coverage. A nil
// registry never changes.
func (r *GlobalSearchCoverageRegistry) Changed() <-chan struct{} {
	if r == nil {
		return nil
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.changed
}

// globalSearchCoverageOf returns the namespaced kinds that opt in to the global
// search index in any version of their manifest, and serve the search and
// list-keys routes in every version. A kind declared by several manifests is
// decided by the first one in the last source that declares it, as for hybrid
// search.
//
// A kind turns those routes off when its lists hide objects in a way generic
// reads cannot repeat, such as showing users only their own. The global index is
// another generic read, so it leaves such a kind out even if it opts in.
func globalSearchCoverageOf(sources ...[]*app.ManifestData) globalSearchTypes {
	out := globalSearchTypes{kinds: map[schema.GroupResource]string{}}
	decided := map[schema.GroupResource]bool{}
	for _, source := range slices.Backward(sources) {
		for _, m := range source {
			if m == nil {
				continue
			}
			names := ManifestKinds(m, nil)
			kinds := map[schema.GroupResource]string{}
			excluded := map[schema.GroupResource]bool{}
			for _, version := range m.Versions {
				for _, kind := range version.Kinds {
					gr := schema.GroupResource{Group: m.Group, Resource: ManifestResourceName(kind)}
					if decided[gr] {
						continue
					}
					if kind.InGlobalSearchIndex() {
						kinds[gr] = names[gr].Kind
					}
					if !kind.HasSearchEndpoint() || !kind.HasListKeysEndpoint() || kind.Scope != namespacedScope {
						excluded[gr] = true
					} else if _, ok := excluded[gr]; !ok {
						excluded[gr] = false
					}
				}
			}
			// Every kind this manifest declares is decided by it, even one that
			// does not opt in, so it overrides an older manifest's opt-in.
			for gr, ex := range excluded {
				decided[gr] = true
				if kind, ok := kinds[gr]; ok && !ex {
					out.kinds[gr] = kind
				}
			}
		}
	}
	out.types = slices.Collect(maps.Keys(out.kinds))
	slices.SortFunc(out.types, func(a, b schema.GroupResource) int { return strings.Compare(a.String(), b.String()) })
	return out
}

// Type-specific builders can fetch external data that this index never uses.
type globalDocumentBuilder struct {
	blob BlobSupport
}

// Unexpected field types must not exclude an otherwise searchable resource.
type globalDocumentSpec struct {
	Title       any `json:"title"`
	Name        any `json:"name"`
	Description any `json:"description"`
	Tags        any `json:"tags"`
}

func (b *globalDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*IndexableDocument, error) {
	// Large panel and query payloads are not needed for standard fields.
	var partial struct {
		Metadata map[string]any     `json:"metadata"`
		Spec     globalDocumentSpec `json:"spec"`
	}
	if err := json.Unmarshal(value, &partial); err != nil {
		return nil, err
	}
	obj := &unstructured.Unstructured{Object: map[string]any{"metadata": partial.Metadata}}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	spec := partial.Spec

	if info := meta.GetBlob(); info != nil {
		if b.blob == nil {
			return nil, fmt.Errorf("blob support is not configured")
		}
		rsp, err := b.blob.GetResourceBlob(ctx, key, info, true)
		if err := ErrorFromResponse(rsp.GetError(), err); err != nil {
			return nil, fmt.Errorf("error reading blob: %w", err)
		}
		var content struct {
			globalDocumentSpec
			Spec *globalDocumentSpec `json:"spec"`
		}
		if err := json.Unmarshal(rsp.GetValue(), &content); err != nil {
			return nil, err
		}
		// Blobs can hold a full resource or just its spec. Keep the stored
		// metadata, which may have changed since the blob was written.
		spec = content.globalDocumentSpec
		if content.Spec != nil {
			spec = *content.Spec
		}
	}

	obj.Object["spec"] = map[string]any{
		"title": spec.Title, "name": spec.Name,
		"description": spec.Description, "tags": spec.Tags,
	}
	return NewIndexableDocument(key, rv, meta, ""), nil
}

// GlobalIndexCoversType reports whether a global index holds documents of this
// resource type, according to the manifests compiled into this binary.
func GlobalIndexCoversType(gr schema.GroupResource) bool {
	_, ok := globalSearchCoverage().kinds[gr]
	return ok
}

// indexSources returns the resource types whose documents belong in the index
// for key. A namespace-wide index draws from every covered type; every other
// index draws from its own type only.
func (s *searchServer) indexSources(key NamespacedResource) []NamespacedResource {
	if !key.IsGlobal() {
		return []NamespacedResource{key}
	}
	return globalSources(key.Namespace, s.globalCoverage.Types())
}

// globalSources returns the given resource types in a namespace.
func globalSources(namespace string, types []schema.GroupResource) []NamespacedResource {
	out := make([]NamespacedResource, 0, len(types))
	for _, gr := range types {
		out = append(out, NamespacedResource{
			Namespace: namespace,
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

// queueTypeSyncs queues a sync of the types each open global index is out of
// date for: types imported since it caught up, which an import replaces without
// announcing any change, and types added to or dropped from what it covers. The
// rebuild queue bounds how many run at once and never overlaps a full rebuild of
// the same index.
//
// openIndexes is every open index, per-resource and global, as the rebuild scan
// lists them; only the global ones have types to sync.
func (s *searchServer) queueTypeSyncs(ctx context.Context, openIndexes []NamespacedResource, lastImportTimes map[NamespacedResource]time.Time) ([]chan struct{}, error) {
	var completeChs []chan struct{}
	var errs []error
	for _, key := range openIndexes {
		if !key.IsGlobal() {
			continue
		}
		idx := s.search.PeekIndex(key)
		if idx == nil {
			continue
		}
		stale, err := s.outOfDateTypes(ctx, key, idx, nil, lastImportTimes)
		if err != nil {
			errs = append(errs, fmt.Errorf("checking which types of %s are out of date: %w", key.String(), err))
			continue
		}
		if len(stale) == 0 {
			continue
		}
		types := make([]schema.GroupResource, 0, len(stale))
		for _, p := range stale {
			types = append(types, groupResourceOf(p.src))
		}
		completeCh := make(chan struct{})
		completeChs = append(completeChs, completeCh)
		s.rebuildQueue.Add(rebuildRequest{
			NamespacedResource: key,
			staleTypes:         types,
			completeChannels:   []chan<- struct{}{completeCh},
		})
		s.indexMetrics.RebuildQueueLength.Set(float64(s.rebuildQueue.Len()))
	}
	return completeChs, errors.Join(errs...)
}

// staleType is a resource type a global index has to rebuild, or, when dropped,
// remove.
type staleType struct {
	src        NamespacedResource
	importedAt time.Time
	// dropped means the global index no longer covers this type, but may still
	// hold documents of it.
	dropped bool
}

// outOfDateTypes returns the types of a global index, limited to only when it is
// not empty, that are out of date: covered types the index has not written in
// full yet, or that storage reports as imported later than the index recorded,
// and types it may hold documents of but no longer covers. Only a newer import counts, the same as for a
// per-resource index, which is rebuilt when its build time is before the last
// import.
// A nil lastImportTimes reads storage directly so rebuild workers re-check queued imports.
func (s *searchServer) outOfDateTypes(ctx context.Context, key NamespacedResource, idx ResourceIndex, only []schema.GroupResource, lastImportTimes map[NamespacedResource]time.Time) ([]staleType, error) {
	recorded, err := idx.CompletedTypeBuilds()
	if err != nil {
		return nil, err
	}
	wanted := func(gr schema.GroupResource) bool {
		return len(only) == 0 || slices.Contains(only, gr)
	}
	var stale []staleType
	for _, src := range s.indexSources(key) {
		gr := groupResourceOf(src)
		if !wanted(gr) {
			continue
		}
		importedAt := lastImportTimes[src]
		if lastImportTimes == nil {
			importedAt, err = s.storage.GetResourceLastImportTime(ctx, src)
			if err != nil {
				return nil, err
			}
		}
		if build, held := recorded[gr]; held && !importedAt.After(build.StorageImportTime) {
			continue
		}
		stale = append(stale, staleType{src: src, importedAt: importedAt})
	}
	// Both records: an import time is recorded only once a type is written in
	// full, and one written in part, as when a release that added it is rolled
	// back mid-sync, has to be removed too.
	held, err := idx.DocumentTypes()
	if err != nil {
		return nil, err
	}
	for gr := range recorded {
		held = append(held, gr)
	}
	slices.SortFunc(held, func(a, b schema.GroupResource) int { return strings.Compare(a.String(), b.String()) })
	for _, gr := range slices.Compact(held) {
		if s.globalCoverage.Covers(gr) || !wanted(gr) {
			continue
		}
		src := NamespacedResource{Namespace: key.Namespace, Group: gr.Group, Resource: gr.Resource}
		stale = append(stale, staleType{src: src, dropped: true})
	}
	// Sorted so the work is done in the same order every time, not in map order.
	slices.SortFunc(stale, func(a, b staleType) int { return strings.Compare(a.src.String(), b.src.String()) })
	return stale, nil
}

// syncTypes brings the given types of a global index, or every type when none
// are given, back in line with storage and with what it covers: it rebuilds the
// covered types that are out of date and removes the dropped ones, recording each
// once done. Each type is checked again first, so a request that waited behind a
// full rebuild does nothing.
func (s *searchServer) syncTypes(ctx context.Context, key NamespacedResource, only []schema.GroupResource) error {
	idx := s.search.PeekIndex(key)
	if idx == nil {
		return nil
	}
	// The import time is read before the rebuild, so an import that lands during
	// it is still seen as newer next time.
	stale, err := s.outOfDateTypes(ctx, key, idx, only, nil)
	if err != nil || len(stale) == 0 {
		return err
	}
	for _, p := range stale {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if p.dropped {
			if err := s.removeResourceType(ctx, idx, key, p.src); err != nil {
				return err
			}
			continue
		}
		res, err := s.rebuildResourceType(ctx, idx, key, p.src)
		if err != nil {
			return err
		}
		s.log.Info("rebuilt a resource type in the global search index", "namespace", key.Namespace, "resource", p.src.GroupResource(),
			"reindexed", res.Reindexed, "removed", res.Removed, "failed", res.Failed)
		// Recorded even when some objects could not be built, or a failure that
		// comes from the object would rebuild the type forever. Those objects are
		// removed, so a reconcile sees them missing and retries them. Read failures
		// return above, unrecorded, and are retried.
		if res.Failed > 0 {
			s.log.Warn("some objects of a rebuilt resource type could not be indexed", "namespace", key.Namespace, "resource", p.src.GroupResource(), "failed", res.Failed)
		}
		if err := idx.RecordCompletedTypeBuild(groupResourceOf(p.src), TypeBuild{StorageImportTime: p.importedAt}); err != nil {
			return err
		}
	}
	return nil
}

// queueReconcile queues a reconcile of one global index, whatever its slot.
func (s *searchServer) queueReconcile(key NamespacedResource) {
	s.reconcileQueue.Add(rebuildRequest{NamespacedResource: key, reconcile: true})
	s.indexMetrics.ReconcileQueueLength.Set(float64(s.reconcileQueue.Len()))
}

// runGlobalIndexReconciler runs queued reconciles. It goes through rebuildIndex,
// so a reconcile never overlaps a rebuild of the same index: one that arrives
// while the index is being rebuilt or reconciled is set aside without blocking
// the worker, and queued again once that finishes.
func (s *searchServer) runGlobalIndexReconciler(ctx context.Context) {
	for {
		req, err := s.reconcileQueue.Next(ctx)
		if err != nil {
			return
		}
		s.indexMetrics.ReconcileQueueLength.Set(float64(s.reconcileQueue.Len()))
		s.rebuildIndex(ctx, req)
	}
}

// queueDueReconciles queues a reconcile of each global index among keys that
// this instance owns and that has not been compared with storage since its last
// slot. The reconcile workers run them, so they are bounded and never overlap a
// rebuild of the same index.
func (s *searchServer) queueDueReconciles(keys []NamespacedResource, now time.Time) {
	for _, key := range keys {
		if !key.IsGlobal() || !s.ownsGlobalIndex(key) {
			continue
		}
		idx := s.search.PeekIndex(key)
		if idx == nil {
			continue
		}
		reconciledAt, err := idx.ReconciledAt()
		if err != nil {
			s.log.Warn("failed to read when the global search index was last reconciled", "namespace", key.Namespace, "error", err)
			continue
		}
		if !reconciledAt.Before(lastReconcileSlot(key, now)) {
			continue
		}
		s.queueReconcile(key)
	}
}

// lastReconcileSlot returns the latest time, at or before now, at which the index
// for key is due to be compared with storage. Each index has its own minute in
// the interval, taken from its key, so the comparisons are spread over the
// whole interval instead of coming due together.
func lastReconcileSlot(key NamespacedResource, now time.Time) time.Time {
	h := fnv.New64a()
	_, _ = h.Write([]byte(key.String()))
	offset := time.Duration(h.Sum64() % uint64(globalIndexReconcileInterval))
	slot := now.Truncate(globalIndexReconcileInterval).Add(offset)
	if slot.After(now) {
		slot = slot.Add(-globalIndexReconcileInterval)
	}
	return slot
}

// reconcileGlobalIndex compares every covered type of a global index with
// storage, and repairs what differs.
//
// A global index replays no events: notifications re-read the objects they
// name. Reconcile repairs what notifications miss: a dropped notification, a
// read or write that failed, a document that failed to build, and whatever
// changed while the index was closed. Comparing the index with storage finds
// all of them, however they happened.
//
// The time is recorded only when every type was compared, so one that failed
// is compared again at the next scan rather than an hour later.
func (s *searchServer) reconcileGlobalIndex(ctx context.Context, key NamespacedResource) (repairResult, error) {
	var total repairResult
	idx := s.search.PeekIndex(key)
	if idx == nil {
		return total, nil
	}
	startedAt := time.Now()
	var errs []error
	defer func() {
		result := "success"
		if len(errs) > 0 {
			result = "failure"
		}
		elapsed := time.Since(startedAt)
		s.indexMetrics.GlobalReconcileDuration.WithLabelValues(result).Observe(elapsed.Seconds())
		s.log.Info("Reconciled global search index", "namespace", key.Namespace, "result", result, "duration", elapsed,
			"reindexed", total.Reindexed, "removed", total.Removed, "failed", total.Failed)
	}()
	for _, src := range s.indexSources(key) {
		if ctx.Err() != nil {
			errs = append(errs, ctx.Err())
			return total, ctx.Err()
		}
		res, err := s.reconcileResourceType(ctx, idx, key, src)
		total.Reindexed += res.Reindexed
		total.Removed += res.Removed
		total.Failed += res.Failed
		if err != nil {
			// The other types are still worth repairing.
			errs = append(errs, fmt.Errorf("reconciling %s: %w", src.GroupResource(), err))
			continue
		}
		if res.Reindexed > 0 || res.Removed > 0 || res.Failed > 0 {
			s.log.Info("reconciled a resource type of the global search index", "namespace", key.Namespace, "resource", src.GroupResource(),
				"reindexed", res.Reindexed, "removed", res.Removed, "failed", res.Failed)
		}
	}
	if len(errs) > 0 {
		return total, errors.Join(errs...)
	}
	return total, idx.RecordReconciledAt(startedAt)
}

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
	diff := newRefDiff()
	_, err := s.storage.ListIterator(ctx, &resourcepb.ListRequest{
		KeysOnly: true,
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{Namespace: src.Namespace, Group: src.Group, Resource: src.Resource},
		},
	}, func(it ListIterator) error {
		return diff.walk(index.ListDocumentRefs(ctx, groupResourceOf(src)), it)
	})
	if err != nil {
		return repairResult{}, err
	}

	missing := slices.Sorted(maps.Keys(diff.onlyStored))
	// Read again rather than removed: the index is read while storage is listed,
	// so a document can be written after the listing passed its name. A delete
	// the index never heard about reads as not found.
	inIndex := slices.AppendSeq(diff.outdated, maps.Keys(diff.onlyIndexed))
	// Sorted so a repair is reproducible, not in map order.
	slices.Sort(inIndex)

	result, err := s.reindex(ctx, index, src, missing, false)
	if err != nil {
		return result, err
	}
	updated, err := s.reindex(ctx, index, src, inIndex, true)
	result.Reindexed += updated.Reindexed
	result.Removed += updated.Removed
	result.Failed += updated.Failed
	return result, err
}

// refDiff is what differs between the index and a listing of storage.
type refDiff struct {
	// Names seen on one side only so far, with their version.
	onlyIndexed map[string]int64
	onlyStored  map[string]int64
	// Indexed at an older version than storage holds.
	outdated []string
}

func newRefDiff() *refDiff {
	return &refDiff{onlyIndexed: map[string]int64{}, onlyStored: map[string]int64{}}
}

// walk reads the index and the listing side by side in name order, so memory
// grows with what differs, not with the size of the type.
//
// Storage lists a name after the names that extend it with "-" or ".", and the
// index before them, so such a name is first seen on one side only. It is
// compared as soon as the other side reaches it, which keeps that bounded too.
func (d *refDiff) walk(indexedRefs iter.Seq2[DocumentRef, error], stored ListIterator) error {
	next, stop := iter.Pull2(indexedRefs)
	defer stop()
	var indexed *DocumentRef
	advance := func() error {
		ref, err, ok := next()
		if !ok {
			indexed = nil
			return nil
		}
		if err != nil {
			return err
		}
		indexed = &ref
		return nil
	}
	if err := advance(); err != nil {
		return err
	}

	for stored.Next() {
		if err := stored.Error(); err != nil {
			return err
		}
		name, rv := stored.Name(), stored.ResourceVersion()
		for indexed != nil && indexed.Name < name {
			d.indexed(indexed.Name, indexed.RV)
			if err := advance(); err != nil {
				return err
			}
		}
		if indexed == nil || indexed.Name != name {
			d.stored(name, rv)
			continue
		}
		d.compare(name, indexed.RV, rv)
		if err := advance(); err != nil {
			return err
		}
	}
	if err := stored.Error(); err != nil {
		return err
	}
	for indexed != nil {
		d.indexed(indexed.Name, indexed.RV)
		if err := advance(); err != nil {
			return err
		}
	}
	return nil
}

func (d *refDiff) indexed(name string, rv int64) {
	if storedRV, ok := d.onlyStored[name]; ok {
		delete(d.onlyStored, name)
		d.compare(name, rv, storedRV)
		return
	}
	d.onlyIndexed[name] = rv
}

func (d *refDiff) stored(name string, rv int64) {
	if indexedRV, ok := d.onlyIndexed[name]; ok {
		delete(d.onlyIndexed, name)
		d.compare(name, indexedRV, rv)
		return
	}
	d.onlyStored[name] = rv
}

// compare leaves a newer indexed version alone: a later change may already be
// indexed.
func (d *refDiff) compare(name string, indexedRV, storedRV int64) {
	if indexedRV < storedRV {
		d.outdated = append(d.outdated, name)
	}
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

	// Read before the listing: otherwise a document created and indexed after the
	// listing looks dropped by the import and is removed while live.
	gr := schema.GroupResource{Group: src.Group, Resource: src.Resource}
	indexed := map[string]struct{}{}
	for ref, err := range index.ListDocumentRefs(ctx, gr) {
		if err != nil {
			return repairResult{}, err
		}
		indexed[ref.Name] = struct{}{}
	}

	builder := &globalDocumentBuilder{blob: s.builders.blob}
	logger := s.log.New("namespace", src.Namespace, "resource", src.GroupResource())

	var result repairResult
	written := map[string]struct{}{}
	_, err := s.storage.ListIterator(ctx, &resourcepb.ListRequest{
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
			items = append(items, &BulkIndexItem{Action: ActionIndex, Doc: doc})
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

// removeResourceType removes every document of a type a global index no longer
// covers, and then forgets the type, so a failure part way is retried.
func (s *searchServer) removeResourceType(ctx context.Context, index ResourceIndex, key, src NamespacedResource) error {
	if err := checkRepairTarget(key, src); err != nil {
		return err
	}
	gr := groupResourceOf(src)
	var names []string
	for ref, err := range index.ListDocumentRefs(ctx, gr) {
		if err != nil {
			return err
		}
		names = append(names, ref.Name)
	}
	slices.Sort(names)
	if err := s.removeFromIndex(index, src, names); err != nil {
		return err
	}
	s.log.Info("removed a resource type the global search index no longer covers", "namespace", key.Namespace, "resource", gr.String(), "removed", len(names))
	return index.ForgetType(gr)
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
// skipped, not fatal, so a bad object does not block the rest; the next reconcile
// retries it. With removeMissing, the names are in the index, and one storage no
// longer holds is removed from it.
//
// Reads go in small chunks, writes in full batches: each write is a separate
// index batch with its own fixed cost.
func (s *searchServer) reindex(ctx context.Context, index ResourceIndex, src NamespacedResource, names []string, removeMissing bool) (repairResult, error) {
	var result repairResult
	if len(names) == 0 {
		return result, nil
	}

	builder := &globalDocumentBuilder{blob: s.builders.blob}
	logger := s.log.New("namespace", src.Namespace, "resource", src.GroupResource())

	items := make([]*BulkIndexItem, 0, maxBatchSize)
	flush := func() error {
		if len(items) == 0 {
			return nil
		}
		if err := index.BulkIndex(&BulkIndexRequest{Items: items, Path: IndexPathUpdate}); err != nil {
			return err
		}
		for _, item := range items {
			if item.Action == ActionDelete {
				result.Removed++
			} else {
				result.Reindexed++
			}
		}
		items = items[:0]
		return nil
	}
	add := func(item *BulkIndexItem) error {
		items = append(items, item)
		if len(items) < maxBatchSize {
			return nil
		}
		return flush()
	}

	// Requests are built a chunk at a time, so only the comparison scales with
	// the size of the type.
	for chunk := range slices.Chunk(names, readChunkSize) {
		requests := make([]BatchReadRequest, 0, len(chunk))
		for _, name := range chunk {
			requests = append(requests, BatchReadRequest{ReadRequest: &resourcepb.ReadRequest{
				Key: &resourcepb.ResourceKey{Namespace: src.Namespace, Group: src.Group, Resource: src.Resource, Name: name},
			}})
		}

		// One response per request, in order, so a not found names its request.
		read := 0
		for response := range readResourcesInChunks(ctx, s.storage, requests, readChunkSize) {
			if ctx.Err() != nil {
				return result, ctx.Err()
			}
			read++
			if response.Error != nil {
				// Anything but not found is a storage failure, returned so the
				// caller does not think the type is repaired.
				if response.Error.Code != http.StatusNotFound || read > len(requests) {
					return result, StatusError(response.Error)
				}
				if !removeMissing {
					continue
				}
				if err := add(&BulkIndexItem{Action: ActionDelete, Key: requests[read-1].Key}); err != nil {
					return result, err
				}
				continue
			}
			doc, err := builder.BuildDocument(ctx, response.Key, response.ResourceVersion, response.Value)
			if err != nil {
				logger.Warn("failed to build a document while reconciling", "key", SearchID(response.Key), "error", err)
				result.Failed++
				continue
			}
			if err := add(&BulkIndexItem{Action: ActionIndex, Doc: doc}); err != nil {
				return result, err
			}
		}
	}
	return result, flush()
}

// watchRetryDelay is how long to wait before asking storage for a new
// notification stream after one ends unexpectedly.
const watchRetryDelay = 5 * time.Second

// maxWatchBatch is how many written keys are taken at once, and
// globalWatchBatchWait how long to wait for more after the first, so a burst of
// writes is read and written together rather than one object at a time.
const (
	maxWatchBatch        = 100
	globalWatchBatchWait = 100 * time.Millisecond
)

// runGlobalIndexWatch applies writes to the global indexes as they happen. A
// global index replays no events, so this is how it learns of changes.
//
// It takes keys straight from the bus rather than the watch pipeline, which holds
// every notification for a few seconds to put them in order. Order does not
// matter here, because each key is only a reason to read the object again.
//
// It is the fast path, not the reliable one: whatever it misses is repaired by
// reconcile, so a failure is logged and the watch opened again.
func (s *searchServer) runGlobalIndexWatch(ctx context.Context) {
	for ctx.Err() == nil {
		// The watch is opened for the covered types, so it is opened again when
		// they change.
		changed := s.globalCoverage.Changed()
		watchCtx, cancel := context.WithCancel(ctx)
		go func() {
			select {
			case <-changed:
				cancel()
			case <-watchCtx.Done():
			}
		}()
		keys, err := s.watchWrittenKeys(watchCtx)
		if err != nil {
			s.log.Warn("failed to watch written keys for global search indexes", "error", err)
		} else {
			// Writes made before the watch was ready, as while the bus was
			// unreachable, were not delivered.
			s.queueReconcileAfterLostKeys("")
			for {
				batch, ok := nextWrittenKeysBatch(watchCtx, keys)
				if !ok {
					break
				}
				s.applyWrittenKeys(watchCtx, batch)
			}
		}
		cancel()
		// The watch failed or its stream ended. Wait before opening it again, so
		// a backend that keeps failing is not asked in a tight loop, unless it
		// ended for a change of the covered types.
		select {
		case <-ctx.Done():
			return
		case <-changed:
		case <-time.After(watchRetryDelay):
		}
	}
}

// watchWrittenKeys watches written keys straight from the bus when the backend
// can, and otherwise takes them from the watch stream, which is a few seconds
// slower but needs no bus.
func (s *searchServer) watchWrittenKeys(ctx context.Context) (<-chan *WrittenEvent, error) {
	keys, err := s.storage.WatchWrittenKeys(ctx, s.globalCoverage.Types(), s.queueReconcileAfterLostKeys)
	if !errors.Is(err, ErrWrittenKeysUnsupported) {
		return keys, err
	}
	s.log.Info("global search indexes follow the watch stream, which is slower than watching written keys", "reason", err)
	return s.storage.WatchWriteEvents(ctx)
}

// queueReconcileAfterLostKeys queues a reconcile of the open global index this
// instance owns for a namespace that may have lost written keys, or of every one
// for an empty namespace: once a watch is ready, after a reconnect, and when
// keys were dropped. It only queues, so it does not block the bus's callback,
// and repeated pending requests for an index are merged.
func (s *searchServer) queueReconcileAfterLostKeys(namespace string) {
	if namespace != "" {
		key := GlobalSearchKey(namespace)
		if s.ownsGlobalIndex(key) && s.search.PeekIndex(key) != nil {
			s.queueReconcile(key)
		}
		return
	}
	for _, key := range s.search.GetOpenIndexes() {
		if key.IsGlobal() && s.ownsGlobalIndex(key) {
			s.queueReconcile(key)
		}
	}
}

// nextWrittenKeysBatch blocks for one key, then takes what else arrives within
// globalWatchBatchWait. It reports false once ctx is cancelled or the stream
// ends.
func nextWrittenKeysBatch(ctx context.Context, keys <-chan *WrittenEvent) ([]*WrittenEvent, bool) {
	var first *WrittenEvent
	select {
	case <-ctx.Done():
		return nil, false
	case key, ok := <-keys:
		if !ok {
			return nil, false
		}
		first = key
	}
	batch := make([]*WrittenEvent, 0, maxWatchBatch)
	batch = append(batch, first)
	wait := time.NewTimer(globalWatchBatchWait)
	defer wait.Stop()
	for len(batch) < maxWatchBatch {
		select {
		case <-ctx.Done():
			return nil, false
		case key, ok := <-keys:
			if !ok {
				return batch, true
			}
			batch = append(batch, key)
		case <-wait.C:
			return batch, true
		}
	}
	return batch, true
}

// applyWrittenKeys re-reads the objects a batch of written keys names and writes
// their current state to the global indexes they belong to. Keys of types the
// index does not cover, and of indexes this instance does not own or has not
// opened, are ignored: an index that is not open catches up when it is opened.
//
// Only the key is used. A late or repeated key then just reads the current
// state again, so it cannot put back an older version or a deleted object. That
// relies on a read after a write is announced seeing that write, which holds
// while storage reads from the database the writes go to.
func (s *searchServer) applyWrittenKeys(ctx context.Context, batch []*WrittenEvent) {
	changed := map[NamespacedResource][]string{}
	var sources []NamespacedResource
	for _, written := range batch {
		if written == nil || written.Key == nil {
			continue
		}
		key := written.Key
		src := NamespacedResource{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}
		if !s.globalCoverage.Covers(groupResourceOf(src)) {
			continue
		}
		names, seen := changed[src]
		if !seen {
			sources = append(sources, src)
		}
		if !slices.Contains(names, key.Name) {
			changed[src] = append(names, key.Name)
		}
	}

	for _, src := range sources {
		if ctx.Err() != nil {
			return
		}
		key := GlobalSearchKey(src.Namespace)
		if !s.ownsGlobalIndex(key) {
			continue
		}
		// Looked up for each batch, so a replaced index is not written to.
		idx := s.search.PeekIndex(key)
		if idx == nil {
			continue
		}
		if err := s.writeCurrentState(ctx, idx, src, changed[src]); err != nil {
			// The next reconcile repairs whatever this missed.
			s.log.Warn("failed to apply written keys to the global search index",
				"namespace", src.Namespace, "resource", src.GroupResource(), "error", err)
		}
	}
}

// writeCurrentState reads the named objects of one type from storage and writes
// what it finds: the object's document if it exists, a removal if it does not.
// An object that cannot be built is removed too, the same as in a type rebuild,
// so a reconcile sees it missing and tries again. An object whose read fails for
// another reason is left as it is, for a reconcile to repair.
func (s *searchServer) writeCurrentState(ctx context.Context, index ResourceIndex, src NamespacedResource, names []string) error {
	builder := &globalDocumentBuilder{blob: s.builders.blob}
	logger := s.log.New("namespace", src.Namespace, "resource", src.GroupResource())

	requests := make([]BatchReadRequest, 0, len(names))
	for _, name := range names {
		requests = append(requests, BatchReadRequest{ReadRequest: &resourcepb.ReadRequest{
			Key: &resourcepb.ResourceKey{Namespace: src.Namespace, Group: src.Group, Resource: src.Resource, Name: name},
		}})
	}

	items := make([]*BulkIndexItem, 0, len(names))
	// Storage answers one response per request, in order, but the reader can add
	// an error of its own after the last one.
	i := 0
	for response := range readResourcesInChunks(ctx, s.storage, requests, readChunkSize) {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if i >= len(requests) {
			logger.Warn("storage answered more reads than were asked for", "error", response.Error.GetMessage())
			break
		}
		key := requests[i].Key
		i++
		if response.Error != nil {
			if response.Error.Code == http.StatusNotFound {
				items = append(items, &BulkIndexItem{Action: ActionDelete, Key: key})
				continue
			}
			logger.Warn("failed to read an object named in a write notification", "key", SearchID(key), "error", response.Error.Message)
			continue
		}
		doc, err := builder.BuildDocument(ctx, key, response.ResourceVersion, response.Value)
		if err != nil {
			logger.Warn("failed to build a document for a write notification", "key", SearchID(key), "error", err)
			items = append(items, &BulkIndexItem{Action: ActionDelete, Key: key})
			continue
		}
		items = append(items, &BulkIndexItem{Action: ActionIndex, Doc: doc})
	}
	if len(items) == 0 {
		return nil
	}
	return index.BulkIndex(&BulkIndexRequest{Items: items, Path: IndexPathUpdate})
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
