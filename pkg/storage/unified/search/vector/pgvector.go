package vector

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	pgvector "github.com/pgvector/pgvector-go"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

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

// Just dashboards for now
// TODO dynamically add new partition/table if resource doesnt exist
func validateResource(resource string) error {
	if resource != "dashboards" {
		return fmt.Errorf("unsupported resource %q (no embeddings sub-tree provisioned)", resource)
	}
	return nil
}

func (b *pgvectorBackend) Upsert(ctx context.Context, vectors []Vector) error {
	if len(vectors) == 0 {
		return nil
	}

	for i := range vectors {
		if err := vectors[i].Validate(); err != nil {
			return fmt.Errorf("vector[%d]: %w", i, err)
		}
	}

	return b.db.WithTx(ctx, nil, func(ctx context.Context, tx db.Tx) error {
		return b.upsertAll(ctx, tx, vectors)
	})
}

func (b *pgvectorBackend) UpsertReplaceSubresources(ctx context.Context, vectors []Vector) error {
	if len(vectors) == 0 {
		return nil
	}
	for i := range vectors {
		if err := vectors[i].Validate(); err != nil {
			return fmt.Errorf("vector[%d]: %w", i, err)
		}
	}

	type uidKey struct{ resource, namespace, model, uid string }
	groups := map[uidKey][]string{}
	for _, v := range vectors {
		k := uidKey{v.Resource, v.Namespace, v.Model, v.UID}
		groups[k] = append(groups[k], v.Subresource)
	}

	return b.db.WithTx(ctx, nil, func(ctx context.Context, tx db.Tx) error {
		for k, kept := range groups {
			if err := validateResource(k.resource); err != nil {
				return err
			}
			stored, err := b.subresourceKeysTx(ctx, tx, k.namespace, k.model, k.resource, k.uid)
			if err != nil {
				return fmt.Errorf("read subresources %s/%s: %w", k.namespace, k.uid, err)
			}
			keep := make(map[string]struct{}, len(kept))
			for _, s := range kept {
				keep[s] = struct{}{}
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
					Resource:     k.resource,
					Namespace:    k.namespace,
					Model:        k.model,
					UID:          k.uid,
					Subresources: stale,
				}
				if _, err := dbutil.Exec(ctx, tx, sqlVectorCollectionDeleteSubresource, req); err != nil {
					return fmt.Errorf("delete stale subresources %s/%s: %w", k.namespace, k.uid, err)
				}
			}
		}
		return b.upsertAll(ctx, tx, vectors)
	})
}

// upsertAll does the per-vector INSERT/UPSERT loop. Caller owns the
// transaction; called from both Upsert and UpsertReplaceSubresources.
func (b *pgvectorBackend) upsertAll(ctx context.Context, tx db.Tx, vectors []Vector) error {
	for i := range vectors {
		if err := validateResource(vectors[i].Resource); err != nil {
			return fmt.Errorf("vector[%d]: %w", i, err)
		}
		emb, err := fitEmbedding(vectors[i].Embedding, EmbeddingDim)
		if err != nil {
			return fmt.Errorf("vector[%d]: %w", i, err)
		}
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
	if err := validateResource(resource); err != nil {
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
	if err := validateResource(resource); err != nil {
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

func (b *pgvectorBackend) GetSubresourceContent(ctx context.Context, namespace, model, resource, uid string) (map[string]string, error) {
	if err := validateResource(resource); err != nil {
		return nil, err
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
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	out := make(map[string]string, len(rows))
	for _, r := range rows {
		out[r.Subresource] = r.Content
	}
	return out, nil
}

func (b *pgvectorBackend) Exists(ctx context.Context, namespace, model, resource, uid string) (bool, error) {
	if err := validateResource(resource); err != nil {
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
	embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error) {
	if err := validateResource(resource); err != nil {
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

	results := make([]VectorSearchResult, len(rows))
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
