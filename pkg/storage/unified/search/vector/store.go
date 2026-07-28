package vector

import (
	"context"
	"encoding/json"
	"errors"
)

// EmbeddingDim is the fixed width of the `embedding halfvec(N)` column. Models
// that produce shorter vectors (e.g. Vertex gemini-embedding-001 at 768) are
// zero-padded up to this width on upsert; longer vectors are rejected.
//
// Zero-padding is harmless under cosine: the trailing zeros contribute nothing
// to dot products or to the L2 norm, so similarity computations are
// equivalent to running them on the un-padded native vectors.
const EmbeddingDim = 1024

// maxTitleLen is the width of the `title VARCHAR(1024)` column. Titles are
// display-only (search results), so an over-long one (e.g. a verbose
// "Dashboard — Panel" subresource title) is truncated to fit rather than
// failing the whole transactional upsert.
const maxTitleLen = 1024

// VectorBackend is vector storage isolated per (namespace, model) so an HNSW
// never mixes embeddings from different vector spaces.
type VectorBackend interface {
	// ResolveCollection maps a (group, resource) pair to its
	// embedding_collections catalog entry. found=false means the pair is
	// not provisioned — callers surface NOT_FOUND.
	ResolveCollection(ctx context.Context, group, resource string) (c Collection, found bool, err error)

	// EnsureCollection resolves (group, resource), provisioning the catalog
	// row and partition on first use. isExternal appends "_external" to the
	// derived partition key. Only upsert paths may call this.
	EnsureCollection(ctx context.Context, group, resource string, isExternal bool) (Collection, error)

	// Search returns top-N nearest neighbors by cosine distance. Query
	// embedding must come from the same model as stored vectors. resource
	// is the partition key (Collection.PartitionKey), not the resource
	// name callers send.
	Search(ctx context.Context, namespace, model, resource string,
		embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error)

	Upsert(ctx context.Context, vectors []Vector) error

	// UpsertReplaceSubresources upserts `changed`, rewrites title/metadata
	// for `metadataOnly` rows (no embedding change), and deletes any stored
	// subresource of (namespace, model, resource, uid) not listed in
	// `desired`, in one transaction. `changed` and `metadataOnly` are
	// disjoint subsets of `desired`. Every vector in `changed` must belong
	// to the given tuple.
	UpsertReplaceSubresources(ctx context.Context, namespace, model, resource, uid string, changed []Vector, metadataOnly []VectorMeta, desired []string) error

	// DeleteRows removes rows selected by sel within (namespace, model,
	// resource). Exactly one selector field must be set. UIDs deletes whole
	// entities (all their subresources) in one statement. All deletes
	// everything, paged by Limit — hasMore reports whether another page
	// remains. model must be non-empty.
	DeleteRows(ctx context.Context, namespace, model, resource string, sel DeleteSelector) (deleted int64, hasMore bool, err error)

	// DeleteSubresources removes specific subresources under `uid`. Empty
	// slice is a no-op. model must be non-empty.
	DeleteSubresources(ctx context.Context, namespace, model, resource, uid string, subresources []string) error

	// DeleteNamespace removes every row belonging to a namespace across all
	// resources and models, plus its cached query embeddings, rate buckets, and
	// promotion log rows. Used when a tenant is hard-deleted. Returns the number
	// of embedding rows removed. Not scoped by model/resource/uid, unlike DeleteRows.
	DeleteNamespace(ctx context.Context, namespace string) (int64, error)

	// GetSubresourceContent returns subresource → stored content and the
	// resource's stored folder ("" when no rows exist; folder is uniform
	// across a resource's rows). Callers diff content to skip re-embedding
	// unchanged rows and compare folder to catch a move, which changes the
	// authz folder but not content.
	GetSubresourceContent(ctx context.Context, namespace, model, resource, uid string) (content map[string]string, folder string, err error)

	// Exists returns true if any row exists for the (namespace, model,
	// resource, uid). Cheap indexed lookup; backfill uses it to skip
	// resources that already have embeddings.
	Exists(ctx context.Context, namespace, model, resource, uid string) (bool, error)

	// GetLatestRV is the reconciler checkpoint. 0 if never advanced.
	GetLatestRV(ctx context.Context) (int64, error)

	// SetLatestRV advances the reconciler checkpoint. The update is
	// monotonic — a smaller rv is silently ignored, so concurrent callers
	// can't rewind the cursor.
	SetLatestRV(ctx context.Context, rv int64) error

	// TryAcquireReconcilerLock obtains a session-level advisory lock so only
	// one reconciler runs across replicas. Same release/leak
	// semantics as TryAcquireBackfillLock; the locks use distinct names so
	// they don't contend with each other.
	TryAcquireReconcilerLock(ctx context.Context) (release func(), acquired bool, err error)

	// ListIncompleteBackfillJobs returns one row per active backfill job for
	// the given model. Filtering server-side keeps instances configured for
	// other embedder models from observing (and erroring on) jobs they don't
	// own. Operators add rows via SQL migrations; the resource embedder drains them.
	ListIncompleteBackfillJobs(ctx context.Context, model string) ([]BackfillJob, error)

	// EnsureResourcePartition creates the embeddings_<resource> partition leaf (idempotent).
	EnsureResourcePartition(ctx context.Context, resource string) error

	// CreateBackfillJob creates a backfill job for (model, resource, stoppingRV).
	// No-op if a job already exists for (model, resource).
	CreateBackfillJob(ctx context.Context, model, resource string, stoppingRV int64) error

	// UpdateBackfillJobCheckpoint writes the cursor + optional error after
	// each processed resource. Best-effort — race with another writer is
	// acceptable since the resource embedder is single-goroutine.
	UpdateBackfillJobCheckpoint(ctx context.Context, id int64, lastSeenKey string, lastErr string) error

	// MarkBackfillJobError stamps last_error without touching last_seen_key.
	// The error path uses this so a job that fails mid-run keeps the most
	// recent per-item checkpoint instead of rewinding to a stale snapshot.
	MarkBackfillJobError(ctx context.Context, id int64, lastErr string) error

	// CompleteBackfillJob marks the job is_complete=true.
	CompleteBackfillJob(ctx context.Context, id int64) error

	// TryAcquireBackfillLock obtains a session-level advisory lock so that
	// only one backfiller runs at a time. Returns (nil, false, nil)
	// when another pod already holds it. The release function unlocks and
	// returns the underlying connection to the pool; safe to call once.
	// On pod crash the underlying connection drops and Postgres releases
	// the lock automatically.
	TryAcquireBackfillLock(ctx context.Context) (release func(), acquired bool, err error)

	// WithEntityLock runs fn while holding a blocking session advisory lock
	// scoped to (namespace, resource, uid). It serializes the
	// read-diff-embed-write window of subresource syncs for one entity so
	// concurrent writers can't interleave stale diffs. The lock rides a
	// dedicated connection; a crash releases it automatically.
	WithEntityLock(ctx context.Context, namespace, resource, uid string, fn func(context.Context) error) error
}

// BackfillJob is one row from vector_backfill_jobs.
//
// Resource scopes the job. Empty means "every registered Builder under
// this Model"; a non-empty value targets exactly that resource. The
// backfiller iterates Builders in deterministic order, applies the
// Resource filter when set, and per-iteration uses Exists() to skip
// already-embedded items.
//
// LastSeenKey is the cursor for the currently-iterated Builder; encoded
// as JSON {"r":<resource>,"t":<continue token>} so resume picks the
// correct Builder.
type BackfillJob struct {
	ID          int64
	Model       string
	Resource    string // empty = all registered resources for this model
	StoppingRV  int64
	LastSeenKey string // empty when starting from the beginning
	IsComplete  bool
	LastError   string
}

// Vector is one embeddable subresource (e.g. a dashboard panel).
type Vector struct {
	Namespace       string
	Resource        string // e.g. "dashboards"
	UID             string // stable resource identifier (e.g. dashboard UID)
	Title           string // human-readable title for search results
	Subresource     string // e.g. "panel/5"
	ResourceVersion int64  // feeds the global checkpoint; not stored per-row
	Folder          string // folder UID for authz filtering
	Content         string // text that was embedded
	Metadata        json.RawMessage
	Embedding       []float32
	Model           string
}

// VectorMeta is a title/metadata-only rewrite of an existing row.
// UpsertReplaceSubresources applies these without touching the embedding, so
// callers keep sync markers (e.g. an embeddedAt stamp) fresh without
// re-embed cost.
type VectorMeta struct {
	Subresource string
	Title       string
	Metadata    json.RawMessage
}

// DeleteSelector picks rows for DeleteRows. Exactly one of UIDs/All is set;
// a Filter field joins with the metadata filter dialect without another method.
type DeleteSelector struct {
	UIDs  []string
	All   bool
	Limit int // page size when All; 0 means defaultDeleteAllPageSize
}

func (v *Vector) Validate() error {
	switch {
	case v.Namespace == "":
		return errors.New("namespace must not be empty")
	case v.Model == "":
		return errors.New("model must not be empty")
	case v.Resource == "":
		return errors.New("resource must not be empty")
	case v.UID == "":
		return errors.New("uid must not be empty")
	case v.Title == "":
		return errors.New("title must not be empty")
	}
	return nil
}

type VectorSearchResult struct {
	UID         string
	Title       string
	Subresource string
	Content     string
	Score       float64
	Folder      string
	Metadata    json.RawMessage
}

// SearchFilter constrains results. Field is a top-level column
// ("uid", "folder") or a JSONB metadata key.
type SearchFilter struct {
	Field  string
	Values []string
}
