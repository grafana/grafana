# PR 1: VectorBackend Interface + pgvector Storage Layer

## Context

This is the first PR in a multi-PR effort to add vector search to Unified Storage (see full design doc: "Unified Storage Vector Search MVP"). It establishes the storage foundation: the `VectorBackend` interface, a pgvector-backed implementation, schema management for a separate PostgreSQL+pgvector database, and configuration.

Grafana Assistant (GA) is the first consumer. Each dashboard panel is embedded as a separate vector stored in pgvector, partitioned by namespace (tenant). This PR does not include embedding generation, the write pipeline, or the gRPC read path -- those come in subsequent PRs.

## Configuration

New INI section `[unified_storage.vector-storage]` for the **separate** pgvector database (not the Grafana database):

```ini
[unified_storage.vector-storage]
db_host = localhost:5432
db_name = grafana_vectors
db_user = grafana
db_password = secret
db_sslmode = disable
```

### Files to modify

- `pkg/setting/setting_unified_storage.go` -- parse the `[unified_storage.vector-storage]` section, add fields to `Cfg`:
  - `VectorDBHost`, `VectorDBName`, `VectorDBUser`, `VectorDBPassword`, `VectorDBSSLMode`
- `pkg/setting/setting.go` -- add the new `Cfg` fields

## VectorBackend Interface

New package: `pkg/storage/unified/search/vector/`

### `store.go` -- Interface and types

```go
type VectorBackend interface {
    // Search performs vector similarity search with optional metadata filtering.
    Search(ctx context.Context, namespace, group, resource string,
        embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error)

    // Upsert inserts or updates vectors. Grouped by namespace internally.
    Upsert(ctx context.Context, vectors []Vector) error

    // Delete removes vectors for a resource. If olderThanRV > 0, only deletes
    // vectors with resource_version < olderThanRV (stale panel cleanup).
    // If olderThanRV == 0, deletes all vectors for the resource.
    Delete(ctx context.Context, namespace, group, resource, name string, olderThanRV int64) error

    // GetLatestRV returns the maximum resource_version stored for a namespace,
    // used by the write pipeline to know where to resume polling.
    GetLatestRV(ctx context.Context, namespace string) (int64, error)
}
```

### Types

```go
// Vector represents a single embeddable subresource (e.g. one dashboard panel).
type Vector struct {
    Namespace       string
    Group           string           // e.g. "dashboard.grafana.app"
    Resource        string           // e.g. "dashboards"
    Name            string           // resource name (dashboard UID)
    Subresource     string           // e.g. "panel/5"
    ResourceVersion int64
    Folder          string
    Content         string           // text that was embedded
    Metadata        json.RawMessage  // JSONB: datasource UIDs/types, query languages, panel type
    Embedding       []float32
    Model           string           // e.g. "text-embedding-005"
}

// VectorSearchResult is a single result from a vector similarity search.
type VectorSearchResult struct {
    Name        string
    Subresource string
    Content     string
    Score       float64
    Folder      string
    Metadata    json.RawMessage
}

// SearchFilter constrains vector search results by metadata.
// Field is either a top-level column ("name", "folder") or a JSONB path
// ("datasource_uids", "query_languages").
type SearchFilter struct {
    Field  string
    Values []string
}
```

## pgvector Implementation

### `pgvector.go` -- `pgvectorBackend` struct

```go
type pgvectorBackend struct {
    db         *sql.DB
    dialect    sqltemplate.Dialect
    partitions sync.Map // map[string]struct{} -- known namespace partitions
    log        log.Logger
}
```

**Constructor**: `NewPgvectorBackend(db *sql.DB) *pgvectorBackend` -- takes a `*sql.DB` connected to the separate pgvector database.

### Partition management

The `pgvectorBackend` holds a `sync.Map` of known namespace partitions. On `Upsert`, before inserting:

1. Check if namespace exists in `sync.Map`
2. If not, execute `CREATE TABLE IF NOT EXISTS resource_embeddings_<sanitized_ns> PARTITION OF resource_embeddings FOR VALUES IN ('<ns>')`
3. Store namespace in `sync.Map`

The ACCESS EXCLUSIVE lock only fires for genuinely new tenants (once per namespace per pod lifetime). After pod restart, the map is empty; the first upsert per namespace re-runs the idempotent DDL, then it's cached.

Namespace sanitization: replace non-alphanumeric characters with `_` for the partition table name.

### Method implementations

**`Upsert(ctx, vectors)`**:
1. Group vectors by namespace
2. Ensure partition exists (sync.Map check + DDL if needed)
3. `INSERT INTO resource_embeddings ... ON CONFLICT (namespace, "group", resource, name, subresource) DO UPDATE SET` embedding, content, metadata, folder, resource_version, model
4. Within a single transaction

**`Delete(ctx, namespace, group, resource, name, olderThanRV)`**:
- `DELETE FROM resource_embeddings WHERE namespace=$1 AND "group"=$2 AND resource=$3 AND name=$4`
- Append `AND resource_version < $5` when `olderThanRV > 0`

**`Search(ctx, namespace, group, resource, embedding, limit, filters)`**:
- `SELECT name, subresource, content, embedding <=> $query AS score, folder, metadata`
- `FROM resource_embeddings WHERE namespace=$1 AND "group"=$2 AND resource=$3`
- Append filter clauses: `name IN (...)` for dashboard UIDs, `folder IN (...)` for folders, `metadata @> '...'` for JSONB filters (datasource_uids, query_languages)
- `ORDER BY embedding <=> $query LIMIT $limit`

**`GetLatestRV(ctx, namespace)`**:
- `SELECT COALESCE(MAX(resource_version), 0) FROM resource_embeddings WHERE namespace=$1`

## SQL Templates

Follow the existing unified storage sqltemplate pattern:

- `.sql` template files in a `data/` subdirectory within the vector package, embedded via `//go:embed`
- Request structs embedding `sqltemplate.SQLTemplate` with `Validate()` methods
- Execution via `dbutil.Exec` / `dbutil.Query` / `dbutil.QueryRow`
- PostgreSQL dialect only (pgvector is PostgreSQL-specific)

### Template files

- `resource_embeddings_upsert.sql` -- INSERT ON CONFLICT DO UPDATE
- `resource_embeddings_delete.sql` -- DELETE with optional olderThanRV filter
- `resource_embeddings_search.sql` -- cosine similarity search with dynamic filters
- `resource_embeddings_get_latest_rv.sql` -- MAX(resource_version)
- `resource_embeddings_create_partition.sql` -- CREATE TABLE IF NOT EXISTS ... PARTITION OF

## Schema Management

The pgvector backend runs idempotent DDL on startup against the separate vector database. Schema defined as embedded SQL in the vector package.

### DDL (PostgreSQL-only)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS resource_embeddings (
    id                BIGSERIAL,
    namespace         VARCHAR(256) NOT NULL,
    "group"           VARCHAR(256) NOT NULL,
    resource          VARCHAR(256) NOT NULL,
    name              VARCHAR(256) NOT NULL,
    subresource       VARCHAR(256) NOT NULL DEFAULT '',
    resource_version  BIGINT NOT NULL,
    folder            VARCHAR(256),
    content           TEXT NOT NULL,
    metadata          JSONB,
    embedding         halfvec(768) NOT NULL,
    model             VARCHAR(256) NOT NULL,
    PRIMARY KEY (namespace, id),
    UNIQUE (namespace, "group", resource, name, subresource)
) PARTITION BY LIST (namespace);

CREATE INDEX IF NOT EXISTS resource_embeddings_hnsw_idx
    ON resource_embeddings USING hnsw (embedding halfvec_cosine_ops)
    WITH (m=16, ef_construction=64);

CREATE INDEX IF NOT EXISTS resource_embeddings_metadata_idx
    ON resource_embeddings USING GIN (metadata);
```

## New Dependency

`github.com/pgvector/pgvector-go` -- provides `pgvector.HalfVector` type and pgx driver registration for halfvec support.

## Tests

### Snapshot tests
SQL template snapshot tests via `mocks.CheckQuerySnapshots`. PostgreSQL dialect only. Testdata files: `testdata/postgres--resource_embeddings_upsert-simple.sql`, etc.

### Unit tests
Mock DB tests using `test.NewDBProviderMatchWords` for each `VectorBackend` method -- verify correct SQL generation, argument binding, and error handling.

### Integration tests
Against real PostgreSQL+pgvector. Gated behind a build tag or test flag. Tests the full lifecycle: schema init, upsert vectors, search, delete, partition creation.

## Files Summary

| File | Purpose |
|------|---------|
| `pkg/setting/setting_unified_storage.go` | Parse `[unified_storage.vector-storage]` config |
| `pkg/setting/setting.go` | Add VectorDB fields to Cfg |
| `pkg/storage/unified/search/vector/store.go` | VectorBackend interface and types |
| `pkg/storage/unified/search/vector/pgvector.go` | pgvectorBackend implementation |
| `pkg/storage/unified/search/vector/schema.go` | Schema DDL and startup initialization |
| `pkg/storage/unified/search/vector/queries.go` | SQL template loading and request structs |
| `pkg/storage/unified/search/vector/data/*.sql` | SQL template files |
| `pkg/storage/unified/search/vector/queries_test.go` | Snapshot tests |
| `pkg/storage/unified/search/vector/pgvector_test.go` | Unit tests with mock DB |
| `pkg/storage/unified/search/vector/testdata/*.sql` | Snapshot test expectations |
