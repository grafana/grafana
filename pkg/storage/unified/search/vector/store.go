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

// VectorBackend is vector storage isolated per (namespace, model) so an HNSW
// never mixes embeddings from different vector spaces.
type VectorBackend interface {
	// Search returns top-N nearest neighbors by cosine distance. Query
	// embedding must come from the same model as stored vectors.
	Search(ctx context.Context, namespace, model, resource string,
		embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error)

	Upsert(ctx context.Context, vectors []Vector) error

	// UpsertReplaceSubresources replaces, in a single transaction, the
	// stored subresource set for each (model, namespace, resource, uid)
	// present in `vectors`: any stored subresource for those tuples that
	// isn't being upserted is deleted, then the input vectors are
	// upserted. Used by the reconciler so stale-row cleanup and
	// the new write commit atomically.
	//
	// TODO: only re-embed and upsert subresources whose content actually
	// changed since the last write. Today the reconciler re-embeds every
	// panel on any dashboard write, which is wasteful when only one
	// panel changed.
	UpsertReplaceSubresources(ctx context.Context, vectors []Vector) error

	// Delete removes every resource and subresource under `uid`. model must be non-empty.
	Delete(ctx context.Context, namespace, model, resource, uid string) error

	// DeleteSubresources removes specific subresources under `uid`. Empty
	// slice is a no-op. model must be non-empty.
	DeleteSubresources(ctx context.Context, namespace, model, resource, uid string, subresources []string) error

	// GetSubresourceContent returns subresource → stored content. Callers
	// diff against candidate content to skip re-embedding unchanged rows.
	// Used for deleting stale subresource embeddings.
	GetSubresourceContent(ctx context.Context, namespace, model, resource, uid string) (map[string]string, error)

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
