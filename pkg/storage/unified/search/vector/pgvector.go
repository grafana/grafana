package vector

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
	"unicode/utf8"

	pgvector "github.com/pgvector/pgvector-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/search/vector")

var _ VectorBackend = (*pgvectorBackend)(nil)

// backfillAdvisoryLockName is hashed by Postgres' hashtext() into the
// 64-bit advisory-lock keyspace. Keeping the lock identity as a string in
// the SQL makes it self-documenting; an operator looking at pg_locks can
// run `SELECT hashtext('vectorbackfiller')::bigint` in psql to find the
// matching row.
const backfillAdvisoryLockName = "vectorbackfiller"

// reconcilerAdvisoryLockName is the per-cycle lock used by the
// reconciler. Distinct from backfillAdvisoryLockName so a backfill and
// a reconciler cycle can run concurrently on the same cluster.
const reconcilerAdvisoryLockName = "vectorreconciler"

type pgvectorBackend struct {
	db       db.DB
	dialect  sqltemplate.Dialect
	log      log.Logger
	promoter *Promoter
	// dbKeepAlive retains a reference to the connection/engine owner so
	// it doesn't get garbage-collected (which would close the underlying
	// *sql.DB). The kvStorageBackend uses the same pattern; xorm engines
	// have finalizers that close the DB on GC. nil is safe.
	dbKeepAlive any
}

func NewPgvectorBackend(ctx context.Context, database db.DB, promotionThreshold int, promoterInterval time.Duration, ownsSchema bool, dbKeepAlive any) *pgvectorBackend {
	b := &pgvectorBackend{
		db:          database,
		dialect:     sqltemplate.PostgreSQL,
		log:         log.New("vector-pgvector"),
		promoter:    NewPromoter(database, promotionThreshold, promoterInterval),
		dbKeepAlive: dbKeepAlive,
	}
	if ownsSchema && b.promoter.interval > 0 {
		go func() {
			if err := b.promoter.Run(ctx); err != nil {
				b.log.Error("vector promoter exited with error", "err", err)
			}
		}()
	}
	return b
}

// fitEmbedding ensures a vector matches the column width. Shorter vectors
// are zero-padded up to dim; longer ones are rejected (truncating would
// silently destroy the embedding's geometry, while zero-padding is safe
// under cosine).
func fitEmbedding(v []float32, dim int) ([]float32, error) {
	switch {
	case len(v) == dim:
		return v, nil
	case len(v) < dim:
		padded := make([]float32, dim)
		copy(padded, v)
		return padded, nil
	default:
		return nil, fmt.Errorf("embedding has %d dims, column accepts at most %d", len(v), dim)
	}
}

// truncateRunes caps s at max runes, never splitting a multi-byte character
// (Postgres VARCHAR(n) counts characters, not bytes). When it has to cut, the
// result ends in "..." to signal truncation and still fits within max. No-op
// when s already fits.
func truncateRunes(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	const ellipsis = "..."
	if max <= len(ellipsis) {
		return string([]rune(s)[:max])
	}
	return string([]rune(s)[:max-len(ellipsis)]) + ellipsis
}

// validateResource rejects operations on partition keys that have no
// catalog entry (unprovisioned — no partition to work with). `resource`
// here is always the partition key: callers resolve caller-facing resource
// names (which may contain chars a table name can't, e.g. hyphens) to
// partition keys via ResolveCollection first; internal callers (reconciler,
// backfill) work in partition keys directly.
func (b *pgvectorBackend) validateResource(ctx context.Context, resource string) error {
	ok, err := b.hasPartitionKey(ctx, resource)
	if err != nil {
		return fmt.Errorf("resolve resource %q: %w", resource, err)
	}
	if !ok {
		return fmt.Errorf("unsupported resource %q (no embeddings sub-tree provisioned)", resource)
	}
	return nil
}

func (b *pgvectorBackend) Upsert(ctx context.Context, vectors []Vector) (retErr error) {
	if len(vectors) == 0 {
		return nil
	}

	ctx, span := tracer.Start(ctx, "unified.vector.pgvector.Upsert")
	defer func() {
		if retErr != nil {
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
		}
		span.End()
	}()
	span.SetAttributes(
		attribute.Int("vector_count", len(vectors)),
		attribute.String("resource", vectors[0].Resource),
		attribute.String("namespace", vectors[0].Namespace),
	)

	// All validation — including the catalog lookup — happens before the
	// transaction opens, so no extra DB queries run mid-transaction. A
	// batch is single-resource, so one string compare per vector and one
	// catalog lookup for the whole batch.
	for i := range vectors {
		if err := vectors[i].Validate(); err != nil {
			return fmt.Errorf("vector[%d]: %w", i, err)
		}
		if vectors[i].Resource != vectors[0].Resource {
			return fmt.Errorf("vector[%d]: resource %q does not match %q (batches are single-resource)",
				i, vectors[i].Resource, vectors[0].Resource)
		}
	}
	if err := b.validateResource(ctx, vectors[0].Resource); err != nil {
		return err
	}

	return b.db.WithTx(ctx, nil, func(ctx context.Context, tx db.Tx) error {
		return b.upsertAll(ctx, tx, vectors)
	})
}

func (b *pgvectorBackend) UpsertReplaceSubresources(ctx context.Context, namespace, model, resource, uid string, changed []Vector, desired []string) (retErr error) {
	// Both empty = no-op; an empty desired must not be read as "delete
	// all" (the reconciler uses Delete for a full wipe).
	if len(changed) == 0 && len(desired) == 0 {
		return nil
	}
	if model == "" {
		return fmt.Errorf("model must not be empty")
	}
	if err := b.validateResource(ctx, resource); err != nil {
		return err
	}
	// Enforce the documented contract that every changed vector belongs to
	// the (namespace, model, resource, uid) tuple — cheap string compares,
	// no catalog lookups. upsertAll does not re-validate per vector.
	for i := range changed {
		if changed[i].Resource != resource {
			return fmt.Errorf("changed[%d]: resource %q does not match %q", i, changed[i].Resource, resource)
		}
	}

	ctx, span := tracer.Start(ctx, "unified.vector.pgvector.UpsertReplaceSubresources")
	defer func() {
		if retErr != nil {
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
		}
		span.End()
	}()
	span.SetAttributes(
		attribute.Int("changed_count", len(changed)),
		attribute.Int("desired_count", len(desired)),
		attribute.String("resource", resource),
		attribute.String("namespace", namespace),
	)

	for i := range changed {
		if err := changed[i].Validate(); err != nil {
			return fmt.Errorf("vector[%d]: %w", i, err)
		}
		if changed[i].Namespace != namespace || changed[i].Model != model ||
			changed[i].Resource != resource || changed[i].UID != uid {
			return fmt.Errorf("vector[%d] does not belong to %s/%s/%s/%s", i, namespace, model, resource, uid)
		}
	}

	keep := make(map[string]struct{}, len(desired))
	for _, s := range desired {
		keep[s] = struct{}{}
	}

	return b.db.WithTx(ctx, nil, func(ctx context.Context, tx db.Tx) error {
		stored, err := b.subresourceKeysTx(ctx, tx, namespace, model, resource, uid)
		if err != nil {
			return fmt.Errorf("read subresources %s/%s: %w", namespace, uid, err)
		}
		var stale []string
		for _, s := range stored {
			if _, ok := keep[s]; !ok {
				stale = append(stale, s)
			}
		}
		if len(stale) > 0 {
			req := &sqlVectorCollectionDeleteSubresourcesRequest{
				SQLTemplate:  sqltemplate.New(b.dialect),
				Resource:     resource,
				Namespace:    namespace,
				Model:        model,
				UID:          uid,
				Subresources: stale,
			}
			if _, err := dbutil.Exec(ctx, tx, sqlVectorCollectionDeleteSubresource, req); err != nil {
				return fmt.Errorf("delete stale subresources %s/%s: %w", namespace, uid, err)
			}
		}
		if len(changed) == 0 {
			return nil
		}
		return b.upsertAll(ctx, tx, changed)
	})
}

// upsertAll does the per-vector INSERT/UPSERT loop. Caller owns the
// transaction and must have validated every vector's resource against the
// catalog BEFORE opening it — no catalog queries in here.
func (b *pgvectorBackend) upsertAll(ctx context.Context, tx db.Tx, vectors []Vector) error {
	for i := range vectors {
		emb, err := fitEmbedding(vectors[i].Embedding, EmbeddingDim)
		if err != nil {
			return fmt.Errorf("vector[%d]: %w", i, err)
		}
		vectors[i].Title = truncateRunes(vectors[i].Title, maxTitleLen)
		req := &sqlVectorCollectionUpsertRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Resource:    vectors[i].Resource,
			Vector:      &vectors[i],
			Embedding:   pgvector.NewHalfVector(emb),
		}
		if _, err := dbutil.Exec(ctx, tx, sqlVectorCollectionUpsert, req); err != nil {
			return fmt.Errorf("upsert vector %s/%s: %w", vectors[i].UID, vectors[i].Subresource, err)
		}
	}
	return nil
}

// subresourceKeysTx reads the stored subresource keys for one UID
// inside the caller's transaction.
func (b *pgvectorBackend) subresourceKeysTx(ctx context.Context, tx db.Tx, namespace, model, resource, uid string) ([]string, error) {
	req := &sqlVectorCollectionGetContentRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Resource:    resource,
		Namespace:   namespace,
		Model:       model,
		UID:         uid,
		Response:    &sqlVectorCollectionGetContentResponse{},
	}
	rows, err := dbutil.Query(ctx, tx, sqlVectorCollectionGetContent, req)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.Subresource)
	}
	return out, nil
}

func (b *pgvectorBackend) Delete(ctx context.Context, namespace, model, resource, uid string) error {
	if model == "" {
		return fmt.Errorf("model must not be empty")
	}
	if err := b.validateResource(ctx, resource); err != nil {
		return err
	}
	req := &sqlVectorCollectionDeleteRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Resource:    resource,
		Namespace:   namespace,
		Model:       model,
		UID:         uid,
	}
	_, err := dbutil.Exec(ctx, b.db, sqlVectorCollectionDelete, req)
	return err
}

func (b *pgvectorBackend) DeleteSubresources(ctx context.Context, namespace, model, resource, uid string, subresources []string) error {
	if model == "" {
		return fmt.Errorf("model must not be empty")
	}
	if len(subresources) == 0 {
		return nil
	}
	if err := b.validateResource(ctx, resource); err != nil {
		return err
	}
	req := &sqlVectorCollectionDeleteSubresourcesRequest{
		SQLTemplate:  sqltemplate.New(b.dialect),
		Resource:     resource,
		Namespace:    namespace,
		Model:        model,
		UID:          uid,
		Subresources: subresources,
	}
	_, err := dbutil.Exec(ctx, b.db, sqlVectorCollectionDeleteSubresource, req)
	return err
}

func (b *pgvectorBackend) GetSubresourceContent(ctx context.Context, namespace, model, resource, uid string) (map[string]string, string, error) {
	if err := b.validateResource(ctx, resource); err != nil {
		return nil, "", err
	}
	req := &sqlVectorCollectionGetContentRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Resource:    resource,
		Namespace:   namespace,
		Model:       model,
		UID:         uid,
		Response:    &sqlVectorCollectionGetContentResponse{},
	}
	rows, err := dbutil.Query(ctx, b.db, sqlVectorCollectionGetContent, req)
	if err != nil {
		return nil, "", err
	}
	if len(rows) == 0 {
		return nil, "", nil
	}
	out := make(map[string]string, len(rows))
	for _, r := range rows {
		out[r.Subresource] = r.Content
	}
	// Folder is uniform across a resource's rows, so any row works.
	return out, rows[0].Folder, nil
}

func (b *pgvectorBackend) Exists(ctx context.Context, namespace, model, resource, uid string) (bool, error) {
	if err := b.validateResource(ctx, resource); err != nil {
		return false, err
	}
	req := &sqlVectorCollectionExistsRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Resource:    resource,
		Namespace:   namespace,
		Model:       model,
		UID:         uid,
		Response:    &sqlVectorCollectionExistsResponse{},
	}
	rows, err := dbutil.Query(ctx, b.db, sqlVectorCollectionExists, req)
	if err != nil {
		return false, err
	}
	return len(rows) > 0, nil
}

func (b *pgvectorBackend) Search(ctx context.Context, namespace, model, resource string,
	embedding []float32, limit int, filters ...SearchFilter) (results []VectorSearchResult, retErr error) {
	ctx, span := tracer.Start(ctx, "unified.vector.pgvector.Search")
	defer func() {
		if retErr != nil {
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
		}
		span.End()
	}()
	span.SetAttributes(
		attribute.String("namespace", namespace),
		attribute.String("model", model),
		attribute.String("resource", resource),
		attribute.Int("limit", limit),
		attribute.Int("filter_count", len(filters)),
	)

	if err := b.validateResource(ctx, resource); err != nil {
		return nil, err
	}
	queryEmb, err := fitEmbedding(embedding, EmbeddingDim)
	if err != nil {
		return nil, fmt.Errorf("query embedding: %w", err)
	}

	// TODO Search is currently single resource but we will need to support cross-resource search eventually
	req := &sqlVectorCollectionSearchRequest{
		SQLTemplate:    sqltemplate.New(b.dialect),
		Resource:       resource,
		Namespace:      namespace,
		Model:          model,
		QueryEmbedding: pgvector.NewHalfVector(queryEmb),
		Limit:          int64(limit),
		Response:       &sqlVectorCollectionSearchResponse{},
	}

	for _, f := range filters {
		switch f.Field {
		case "uid":
			req.UIDValues = f.Values
		case "folder":
			req.FolderValues = f.Values
		default:
			// JSONB containment: metadata @> '{"field":["v1","v2"]}'
			j, _ := json.Marshal(map[string][]string{f.Field: f.Values})
			req.MetadataFilters = append(req.MetadataFilters, MetadataFilterEntry{JSON: string(j)})
		}
	}

	rows, err := dbutil.Query(ctx, b.db, sqlVectorCollectionSearch, req)
	if err != nil {
		return nil, err
	}

	results = make([]VectorSearchResult, len(rows))
	for i, row := range rows {
		results[i] = VectorSearchResult{
			UID:         row.UID,
			Title:       row.Title,
			Subresource: row.Subresource,
			Content:     row.Content,
			Score:       row.Score,
			Folder:      row.Folder,
			Metadata:    row.Metadata,
		}
	}
	return results, nil
}

func (b *pgvectorBackend) ListIncompleteBackfillJobs(ctx context.Context, model string) ([]BackfillJob, error) {
	req := &sqlVectorBackfillJobsListRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Model:       model,
		Response:    &sqlVectorBackfillJobsListResponse{},
	}
	rows, err := dbutil.Query(ctx, b.db, sqlVectorBackfillJobsList, req)
	if err != nil {
		return nil, fmt.Errorf("list incomplete backfill jobs: %w", err)
	}
	out := make([]BackfillJob, 0, len(rows))
	for _, r := range rows {
		out = append(out, BackfillJob{
			ID:          r.ID,
			Model:       r.Model,
			Resource:    r.Resource,
			StoppingRV:  r.StoppingRV,
			LastSeenKey: r.LastSeenKey.String,
			IsComplete:  r.IsComplete,
			LastError:   r.LastError.String,
		})
	}
	return out, nil
}

// EnsureResourcePartition creates the embeddings_<resource> partition leaf and
// its metadata index. The per-resource advisory lock serializes the attach
// (ACCESS EXCLUSIVE on the parent) so concurrent replicas don't race it.
func (b *pgvectorBackend) EnsureResourcePartition(ctx context.Context, resource string) error {
	// resource is interpolated unquoted into the DDL below; reject anything
	// sanitizeIdentifier would alter to keep it injection-safe.
	if resource == "" || sanitizeIdentifier(resource) != resource {
		return fmt.Errorf("ensure partition: unsafe resource %q", resource)
	}
	leaf := subtreeName(resource) // embeddings_<resource>
	idx := leaf + "_metadata_idx"

	// Fast path: skip the lock + DDL only when BOTH leaf and index exist.
	// Checking the index too lets a retry finish a prior attempt that created
	// the leaf but failed before the index.
	ready, err := b.resourcePartitionReady(ctx, leaf, idx)
	if err != nil {
		return fmt.Errorf("check partition %s: %w", leaf, err)
	}
	if ready {
		return nil
	}

	conn, err := b.db.SqlDB().Conn(ctx)
	if err != nil {
		return fmt.Errorf("ensure partition conn: %w", err)
	}
	defer func() { _ = conn.Close() }()

	lockName := "vectorpartition_" + resource
	if _, err := conn.ExecContext(ctx,
		"SELECT pg_advisory_lock(hashtext($1)::bigint)", lockName); err != nil {
		return fmt.Errorf("ensure partition lock: %w", err)
	}
	defer func() {
		_, _ = conn.ExecContext(context.Background(),
			"SELECT pg_advisory_unlock(hashtext($1)::bigint)", lockName)
	}()

	if _, err := conn.ExecContext(ctx, fmt.Sprintf(
		`CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES IN ('%s')`,
		leaf, unifiedParent, resource,
	)); err != nil {
		return fmt.Errorf("create partition %s: %w", leaf, err)
	}
	if _, err := conn.ExecContext(ctx, fmt.Sprintf(
		`CREATE INDEX IF NOT EXISTS %s ON %s USING GIN (metadata)`,
		idx, leaf,
	)); err != nil {
		return fmt.Errorf("create metadata index on %s: %w", leaf, err)
	}
	return nil
}

// resourcePartitionReady reports whether leaf is attached as a partition of
// the parent (pg_inherits, not to_regclass, so a same-named unrelated table
// can't match) AND its metadata index exists.
func (b *pgvectorBackend) resourcePartitionReady(ctx context.Context, leaf, idx string) (bool, error) {
	var ready bool
	err := b.db.QueryRowContext(ctx, `
		SELECT
			EXISTS (
				SELECT 1 FROM pg_inherits i
				JOIN pg_class c ON c.oid = i.inhrelid
				JOIN pg_class p ON p.oid = i.inhparent
				WHERE p.relname = $1 AND c.relname = $2
			)
			AND EXISTS (
				SELECT 1 FROM pg_class WHERE relname = $3 AND relkind = 'i'
			)`, unifiedParent, leaf, idx).Scan(&ready)
	if err != nil {
		return false, err
	}
	return ready, nil
}

func (b *pgvectorBackend) CreateBackfillJob(ctx context.Context, model, resource string, stoppingRV int64) error {
	req := &sqlVectorBackfillJobsCreateRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Model:       model,
		Resource:    resource,
		StoppingRV:  stoppingRV,
	}
	if _, err := dbutil.Exec(ctx, b.db, sqlVectorBackfillJobsCreate, req); err != nil {
		return fmt.Errorf("create backfill job (%s,%s): %w", model, resource, err)
	}
	return nil
}

func (b *pgvectorBackend) UpdateBackfillJobCheckpoint(ctx context.Context, id int64, lastSeenKey string, lastErr string) error {
	req := &sqlVectorBackfillJobsUpdateRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		ID:          id,
		LastSeenKey: sql.NullString{String: lastSeenKey, Valid: lastSeenKey != ""},
		LastError:   sql.NullString{String: lastErr, Valid: lastErr != ""},
	}
	_, err := dbutil.Exec(ctx, b.db, sqlVectorBackfillJobsUpdate, req)
	if err != nil {
		return fmt.Errorf("update backfill job %d: %w", id, err)
	}
	return nil
}

func (b *pgvectorBackend) MarkBackfillJobError(ctx context.Context, id int64, lastErr string) error {
	req := &sqlVectorBackfillJobsSetErrorRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		ID:          id,
		LastError:   sql.NullString{String: lastErr, Valid: lastErr != ""},
	}
	if _, err := dbutil.Exec(ctx, b.db, sqlVectorBackfillJobsSetError, req); err != nil {
		return fmt.Errorf("mark backfill job %d error: %w", id, err)
	}
	return nil
}

func (b *pgvectorBackend) CompleteBackfillJob(ctx context.Context, id int64) error {
	req := &sqlVectorBackfillJobsCompleteRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		ID:          id,
	}
	_, err := dbutil.Exec(ctx, b.db, sqlVectorBackfillJobsComplete, req)
	if err != nil {
		return fmt.Errorf("complete backfill job %d: %w", id, err)
	}
	return nil
}

func (b *pgvectorBackend) TryAcquireBackfillLock(ctx context.Context) (func(), bool, error) {
	conn, err := b.db.SqlDB().Conn(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("acquire backfill conn: %w", err)
	}
	var got bool
	if err := conn.QueryRowContext(ctx,
		"SELECT pg_try_advisory_lock(hashtext($1)::bigint)", backfillAdvisoryLockName,
	).Scan(&got); err != nil {
		_ = conn.Close()
		return nil, false, fmt.Errorf("pg_try_advisory_lock: %w", err)
	}
	if !got {
		_ = conn.Close()
		return nil, false, nil
	}
	release := func() {
		// Use Background so a cancelled parent doesn't prevent unlock.
		_, _ = conn.ExecContext(context.Background(),
			"SELECT pg_advisory_unlock(hashtext($1)::bigint)", backfillAdvisoryLockName)
		_ = conn.Close()
	}
	return release, true, nil
}

func (b *pgvectorBackend) GetLatestRV(ctx context.Context) (int64, error) {
	var rv int64
	row := b.db.QueryRowContext(ctx, `SELECT latest_rv FROM vector_latest_rv WHERE id = 1`)
	if err := row.Scan(&rv); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil
		}
		return 0, fmt.Errorf("read vector_latest_rv: %w", err)
	}
	return rv, nil
}

// SetLatestRV bumps the checkpoint. The WHERE guard makes this monotonic;
// a stale rv from a slower replica can't rewind a more advanced cursor.
func (b *pgvectorBackend) SetLatestRV(ctx context.Context, rv int64) error {
	if rv <= 0 {
		return nil
	}
	if _, err := b.db.ExecContext(ctx,
		`UPDATE vector_latest_rv SET latest_rv = $1 WHERE id = 1 AND latest_rv < $1`,
		rv,
	); err != nil {
		return fmt.Errorf("set vector_latest_rv: %w", err)
	}
	return nil
}

func (b *pgvectorBackend) TryAcquireReconcilerLock(ctx context.Context) (func(), bool, error) {
	conn, err := b.db.SqlDB().Conn(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("acquire reconciler conn: %w", err)
	}
	var got bool
	if err := conn.QueryRowContext(ctx,
		"SELECT pg_try_advisory_lock(hashtext($1)::bigint)", reconcilerAdvisoryLockName,
	).Scan(&got); err != nil {
		_ = conn.Close()
		return nil, false, fmt.Errorf("pg_try_advisory_lock: %w", err)
	}
	if !got {
		_ = conn.Close()
		return nil, false, nil
	}
	release := func() {
		_, _ = conn.ExecContext(context.Background(),
			"SELECT pg_advisory_unlock(hashtext($1)::bigint)", reconcilerAdvisoryLockName)
		_ = conn.Close()
	}
	return release, true, nil
}
