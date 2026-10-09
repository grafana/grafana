package model

import (
	"context"
	"iter"
	"slices"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/grafana/authlib/types"
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type IndexAction int

const (
	ActionIndex IndexAction = iota
	ActionDelete
)

type BulkIndexItem struct {
	Action IndexAction
	Key    *resourcepb.ResourceKey // Only used for delete actions
	Doc    *IndexableDocument      // Only used for index actions
}

type BulkIndexRequest struct {
	Items           []*BulkIndexItem
	ResourceVersion int64
	// Path names the loop these items came from (build, update, trash), so what
	// the index records for them lines up with what the caller records. Empty
	// when the caller does not measure.
	Path string
}

type IndexBuildInfo struct {
	BuildTime          time.Time       // Timestamp when the index was built. This value doesn't change on subsequent index updates.
	BuildVersion       *semver.Version // Grafana version used when originally building the index. This value doesn't change on subsequent index updates.
	SelectableFields   []string        // List of selectable fields used when index was built.
	SearchFieldsHash   string          // Hash captured at build time over the SearchFieldDefinition slices registered for (group, resource), across all versions. Empty when no SearchFieldsProvider was in use.
	Features           []IndexFeature  // Index features the index was built with. Empty on indexes built before index features existed.
	ReaderRequirements []IndexFeature  // Features a reader must understand before using this index. Empty on indexes built before requirements were recorded.
}

// IndexFeature names something about an index the search fields hash does not
// capture: an internal marker no field declares, a storage choice a declaration
// does not describe, or fields kept out of the hash on purpose (see
// TrashSearchFieldDefinitions). Changes the hash covers already force a rebuild.
// Making such a change without adding a feature for it is silent: nothing
// rebuilds, and older indexes keep serving without the mapping.
type IndexFeature string

// IndexFeatureTrashFields means the index maps TrashSearchFieldDefinitions. An
// index without them drops the values, so trash would come back missing the
// deleter and in arbitrary order. Required, so such an index is rebuilt before it
// serves anything.
const IndexFeatureTrashFields IndexFeature = "trash-fields"

// IndexFeatureDeletedMarker means the index maps the markers on deleted
// documents, SEARCH_FIELD_IS_DELETED and SEARCH_FIELD_IS_PROVISIONED. An index
// without them drops the values, so a deleted document indexed there would look
// live, and a provisioned one would show up in trash. Required too: both mappings
// arrived together, so an index has either both or neither.
const IndexFeatureDeletedMarker IndexFeature = "deleted-marker"

// IndexFeatureSortableTrashResourceVersion means deleted documents carry an
// exact, fixed-width resource version that can be sorted without float64
// rounding or lexical misordering. Recorded but not required so it does not
// force a rebuild; callers can fall back when an older index lacks it.
const IndexFeatureSortableTrashResourceVersion IndexFeature = "sortable-trash-resource-version"

// IndexFeatureStoredFacets means every facet-capable field is stored, so the
// post-rank authorization path can aggregate facets app-side. Native bleve
// faceting reads the index, not the stored values, so this is required only
// where post-rank authorization runs — see RequiredIndexFeatures. Without it,
// that path reports facet-capable but unstored fields as missing values.
const IndexFeatureStoredFacets IndexFeature = "facets-are-stored"

// IndexFeatureStoredResourceVersion means the index stores each document's resource
// version; without it a search returns 0, which callers read as "unknown".
//
// Recorded but not required, because requiring it rebuilds every existing index at
// once. Recording it now is what lets a later release require it.
const IndexFeatureStoredResourceVersion IndexFeature = "resource-version-stored"

// IndexFeatureHoldsDeletedDocuments means the index keeps deleted documents, so a
// reader that does not exclude them returns deleted resources as live. It says what
// the index holds, not what it maps, and every index built now holds them. Older
// indexes hold none, and nothing in their mapping says so, which is why this is
// written down instead of assumed.
const IndexFeatureHoldsDeletedDocuments IndexFeature = "holds-deleted-documents"

// TrashIndexFeatures are the features an index needs before a deleted document may
// be kept in it. Read by the writers and by requiredIndexFeatures, so nothing can
// disagree about what makes an index usable for trash.
func TrashIndexFeatures() []IndexFeature {
	return []IndexFeature{IndexFeatureDeletedMarker, IndexFeatureTrashFields}
}

// currentIndexFeatures is recorded in every index this binary builds.
//
// A feature that changes which documents the index holds, not just how they are
// mapped, belongs in IndexReaderRequirements too, and must not be enabled here
// until that check has shipped for longer than the compatibility window —
// instances without the check ignore the requirement and read the index anyway.
var currentIndexFeatures = []IndexFeature{
	IndexFeatureDeletedMarker,
	IndexFeatureHoldsDeletedDocuments,
	IndexFeatureSortableTrashResourceVersion,
	IndexFeatureStoredFacets,
	IndexFeatureStoredResourceVersion,
	IndexFeatureTrashFields,
}

// knownIndexFeatures is every feature this binary can read. A feature belongs here
// from the release that implements its reading side, even if nothing builds indexes
// with it yet. Only ever grows.
var knownIndexFeatures = []IndexFeature{
	IndexFeatureDeletedMarker,
	IndexFeatureHoldsDeletedDocuments,
	IndexFeatureSortableTrashResourceVersion,
	IndexFeatureStoredFacets,
	IndexFeatureStoredResourceVersion,
	IndexFeatureTrashFields,
}

// requiredIndexFeatures is the subset an index must already have to be used. An
// index without one of these features is rebuilt before it serves anything, even
// on startup, so only require a feature whose absence gives wrong answers — not
// one that only makes results incomplete. Requiring a feature also makes every
// existing index rebuild once.
//
// Every required feature must also be current, otherwise indexes rebuild forever
// (TestRequiredIndexFeaturesAreCurrent).
//
// Without the trash features the writers drop deleted documents, so trash comes
// back empty, which reads as "nothing was deleted".
//
// IndexFeatureHoldsDeletedDocuments is required for the same reason, one step later: an
// index built before deleted documents were kept maps the trash fields but holds nothing
// in them, and a file-based index is reused across an upgrade, so trash would stay
// unavailable until some unrelated change triggered a rebuild.
var requiredIndexFeatures = slices.Concat(TrashIndexFeatures(), []IndexFeature{IndexFeatureHoldsDeletedDocuments})

// CurrentIndexFeatures returns the features sorted, so declaration order cannot
// change what an index records.
func CurrentIndexFeatures() []IndexFeature {
	return slices.Sorted(slices.Values(currentIndexFeatures))
}

// RequiredIndexFeatures returns the features an index must have to be used.
// postRankAuthz adds the features only that path depends on, so deployments
// serving facets from bleve itself are not rebuilt for it.
func RequiredIndexFeatures(postRankAuthz bool) []IndexFeature {
	features := requiredIndexFeatures
	if postRankAuthz {
		features = append(slices.Clone(features), IndexFeatureStoredFacets)
	}
	return slices.Sorted(slices.Values(features))
}

// MissingIndexFeatures returns the required features the index does not have.
// Features the index has and this binary does not require are ignored: an index
// from a newer binary is the build version check's business.
func MissingIndexFeatures(buildInfo IndexBuildInfo, requiredFeatures []IndexFeature) []IndexFeature {
	return MissingFeatures(buildInfo.Features, requiredFeatures)
}

// MissingFeatures returns the required features absent from have. Takes the
// feature list on its own, for callers holding a snapshot manifest rather than
// an opened index.
func MissingFeatures(have, requiredFeatures []IndexFeature) []IndexFeature {
	var missing []IndexFeature
	for _, feature := range requiredFeatures {
		if !slices.Contains(have, feature) {
			missing = append(missing, feature)
		}
	}
	return missing
}

// IndexReaderRequirements returns the features a reader has to understand before it
// may use an index built now. An instance old enough not to know that an index can
// hold deleted documents would return them as live search results, so it refuses
// the index instead (see UnknownIndexRequirements).
//
// This does not work the other way round: an existing index that holds no deleted
// documents is not rebuilt for it, because the feature is recorded rather than
// required. Such an index keeps serving live searches, and trash stays unavailable
// for it until it is rebuilt for some other reason.
func IndexReaderRequirements() []IndexFeature {
	return []IndexFeature{IndexFeatureHoldsDeletedDocuments}
}

// UnknownIndexRequirements returns declared requirements this binary does not
// recognise; a non-empty result means the index must not be used. Matching on known
// names rather than required ones is what lets an instance refuse a feature added
// after it shipped.
func UnknownIndexRequirements(requirements []IndexFeature) []IndexFeature {
	var unknown []IndexFeature
	for _, feature := range requirements {
		if !slices.Contains(knownIndexFeatures, feature) {
			unknown = append(unknown, feature)
		}
	}
	return unknown
}

type ResourceIndex interface {
	// BulkIndex allows for multiple index actions to be performed in a single call.
	// The order of the items is guaranteed to be the same as the input
	BulkIndex(req *BulkIndexRequest) error

	// Search within a namespaced resource
	// When working with federated queries, the additional indexes will be passed in explicitly
	Search(ctx context.Context, access types.AccessClient, req *resourcepb.ResourceSearchRequest, federate []ResourceIndex, stats *SearchStats) (*resourcepb.ResourceSearchResponse, error)

	// List within an response
	ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest, stats *SearchStats) (*resourcepb.ListManagedObjectsResponse, error)

	// Counts the values in a repo
	CountManagedObjects(ctx context.Context, stats *SearchStats) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error)

	// Get the number of documents in the index
	DocCount(ctx context.Context, folder string, stats *SearchStats) (int64, error)

	// ListDocumentRefs enumerates the live documents the index holds for one
	// resource type, as the name and the resource version each was indexed at.
	// Reconciliation compares that with what storage holds, so it needs the whole
	// set rather than a ranked page.
	ListDocumentRefs(ctx context.Context, gr schema.GroupResource) iter.Seq2[DocumentRef, error]

	// DocumentTypes returns the resource types the index may hold documents of.
	// Each is recorded before its first document is written, so a type written
	// only in part is included, and stays until ForgetType.
	DocumentTypes() ([]schema.GroupResource, error)

	// CompletedTypeBuilds returns every resource type the index has written in
	// full, by an index build or a type rebuild, with what storage reported then.
	// A type missing from it may still have documents, as one written only in
	// part; DocumentTypes lists those. Kept inside the index, so a restarted
	// server does not redo work the index already did.
	CompletedTypeBuilds() (map[schema.GroupResource]TypeBuild, error)

	// RecordCompletedTypeBuild records that the index has written one resource
	// type in full.
	RecordCompletedTypeBuild(gr schema.GroupResource, build TypeBuild) error

	// ReconciledAt returns when the index was last compared with storage, or
	// built from it, zero if never. Kept inside the index, so a restarted server
	// does not compare an index it compared recently.
	ReconciledAt() (time.Time, error)

	// RecordReconciledAt records that the index matched storage as of t.
	RecordReconciledAt(t time.Time) error

	// ForgetType records that the index no longer holds one resource type,
	// removing it from both CompletedTypeBuilds and DocumentTypes.
	ForgetType(gr schema.GroupResource) error

	// UpdateIndex updates the index with the latest data (using update function provided when index was built) to guarantee strong consistency during the search.
	// Returns RV to which index was updated.
	UpdateIndex(ctx context.Context) (int64, error)

	// BuildInfo returns build information about the index.
	BuildInfo() (IndexBuildInfo, error)
}

// TypeBuild is what an index records when it has written one resource type in
// full.
type TypeBuild struct {
	// StorageImportTime is the import time storage reported for the type when
	// the build read it, zero if the type was never imported. Storage reporting a
	// newer one means an import has replaced the type since, and the index is
	// behind.
	StorageImportTime time.Time
}

// DocumentRef is what an index knows about one document without reading it.
//
// It carries no namespace, group or resource, because the caller supplied all
// three: the index covers one namespace, and the enumeration is of one resource
// type within it.
type DocumentRef struct {
	// Name is the Kubernetes name, the same one a resource key carries. It is
	// unique within a namespace, group and resource, which is what makes it enough
	// to identify a document here.
	Name string

	// RV is the resource version the document was indexed at, which is how a
	// caller tells an out-of-date document from a current one. Zero when the index
	// holds no readable version, which a caller treats as out of date.
	RV int64
}

type BuildFn func(index ResourceIndex) (int64, error)

// UpdateFn is responsible for updating index with changes since given RV. It should return new RV (to be used as next sinceRV), number of updated documents and error, if any.
type UpdateFn func(context context.Context, index ResourceIndex, sinceRV int64) (newRV int64, updatedDocs int, _ error)

// SearchBackend contains the technology specific logic to support search.
type SearchBackend interface {
	// LoadOpenIndexStats returns recently-open indexes from local backend state.
	// Empty stats means no usable state exists, and callers should fall back to storage stats.
	LoadOpenIndexStats(now time.Time, maxAge time.Duration) ([]resourcecontract.ResourceStats, error)

	// WriteOpenIndexStats persists currently-open indexes to local backend state.
	WriteOpenIndexStats(now time.Time) error

	// GetIndex returns existing index, or nil.
	GetIndex(key resourcecontract.NamespacedResource) ResourceIndex

	// BuildIndex builds an index from scratch.
	// Depending on the size hint, the backend may choose different options (eg: memory vs disk).
	// A negative size means the caller does not have a cheap size hint.
	// The last known resource version can be used to detect that nothing has changed, and existing on-disk index can be reused.
	// The builder will write all documents before returning.
	// Updater function is used to update the index before performing the search.
	// rebuild forces a full rebuild of the index, regardless of state.
	// lastImportTime is used to determine if an existing file-based index needs to be rebuilt before opening.
	// maxFreshSnapshotAge is the freshness window (by snapshot BuildTime) within
	// which a same-version remote snapshot is preferred over rebuilding from
	// scratch on the rebuild path. Zero disables that fast path.
	BuildIndex(
		ctx context.Context,
		key resourcecontract.NamespacedResource,
		size int64,
		indexBuildReason string,
		builder BuildFn,
		updater UpdateFn,
		rebuild bool,
		lastImportTime time.Time,
		maxFreshSnapshotAge time.Duration,
	) (ResourceIndex, error)

	// TotalDocs returns the total number of documents across all indexes.
	TotalDocs() int64

	// SnapshotCountThreshold returns the document count at or above which
	// BuildIndex uses remote snapshots, or 0 when snapshots are inactive (no
	// store configured). The startup prebuild uses it to cap counting without
	// changing the snapshot decision.
	SnapshotCountThreshold() int64

	// GetOpenIndexes returns the list of indexes that are currently open.
	GetOpenIndexes() []resourcecontract.NamespacedResource

	// RemoveExpiredTrash deletes trash documents for objects that garbage
	// collection has already removed from storage. The backend decides what is
	// expired, because it holds the retention window. Errors are the backend's to
	// log: a caller can only let the next pass try again.
	RemoveExpiredTrash(ctx context.Context)

	// Stop closes indexes and stops backend background tasks.
	Stop()
}
