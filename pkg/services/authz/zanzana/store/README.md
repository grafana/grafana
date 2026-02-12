# Zanzana store and TupleStorageService

In **custom** tuple storage mode, Grafana (Zanzana) owns the control plane—stores, authorization models, and assertions—while a separate service owns the **tuple** data. That service implements a small gRPC API; Grafana talks to it for all tuple reads and writes. This keeps the integration surface minimal and lets you plug in your own storage or multi-tenant backend.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Grafana / Zanzana                        │
├─────────────────────────────────────────────────────────────┤
│  Stores:      Configured at startup (namespace → store_id)  │
│  Models:      Embedded in code (schema_*.fga)               │
│  Assertions:  Test-only (not in production)                 │
├─────────────────────────────────────────────────────────────┤
│                          │                                   │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           TupleStorageService (external service)      │  │
│  │  • WriteTuples                                        │  │
│  │  • ReadTuples                                         │  │
│  │  • ReadTuplesByUser                                   │  │
│  │  • ReadChanges                                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Service interface (proto)

The tuple service implements exactly four RPCs:

```protobuf
service TupleStorageService {
    rpc WriteTuples(WriteTuplesRequest) returns (WriteTuplesResponse);
    rpc ReadTuples(ReadTuplesRequest) returns (stream Tuple);
    rpc ReadTuplesByUser(ReadTuplesByUserRequest) returns (stream Tuple);
    rpc ReadChanges(ReadChangesRequest) returns (ReadChangesResponse);
}
```

Full message definitions live in `pkg/services/authz/proto/v1/tuple_storage.proto`.

## Implementing the service (SQL reference)

To implement the TupleStorageService against your own database, you need to persist tuples and optionally a changelog, then map each RPC to SQL (or equivalent queries). The following illustrates a minimal schema and the queries that correspond to each proto request. Adapt table and column names to your environment (e.g. PostgreSQL, MySQL, or a key-value store with secondary indexes).

### Suggested table layout

Store relationship tuples in a single table keyed by store and object/relation/user. Use a separate changelog table if you need to support `ReadChanges` (e.g. for Watch/consistency).

```sql
-- Tuples: one row per relationship. (object_type, object_id) = object; (user_type, user_id, user_relation) = user.
CREATE TABLE tuple (
    store_id        TEXT NOT NULL,
    object_type     TEXT NOT NULL,
    object_id       TEXT NOT NULL,
    relation        TEXT NOT NULL,
    user_type       TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    user_relation   TEXT NOT NULL,
    condition_name  TEXT,
    condition_ctx   TEXT,   -- JSON, optional
    inserted_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (store_id, object_type, object_id, relation, user_type, user_id, user_relation)
);

-- Changelog: one row per write/delete for ReadChanges (ordered by ulid or timestamp).
CREATE TABLE changelog (
    store_id     TEXT NOT NULL,
    ulid         TEXT NOT NULL,   -- or BIGINT / timestamp for ordering
    operation    TEXT NOT NULL,   -- 'write' | 'delete'
    object_type  TEXT NOT NULL,
    object_id    TEXT NOT NULL,
    relation     TEXT NOT NULL,
    user_type    TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    user_relation TEXT NOT NULL,
    condition_name TEXT,
    condition_ctx  TEXT,
    tuple_timestamp TIMESTAMP,
    PRIMARY KEY (store_id, ulid)
);
CREATE INDEX idx_changelog_store_ulid ON changelog (store_id, ulid);
```

For indexes: support **forward lookups** by object (ReadTuples) and **reverse lookups** by user (ReadTuplesByUser), e.g.:

```sql
CREATE INDEX idx_tuple_read_tuples
  ON tuple (store_id, object_type, object_id, relation);

CREATE INDEX idx_tuple_read_by_user
  ON tuple (store_id, user_type, user_id, user_relation, object_type, relation);
```

### WriteTuples

**Request:** `store_id`, `writes[]` (each with key: object_type, object_id, relation, user_type, user_id, user_relation; optional condition_name, condition_context), `deletes[]` (same key fields).

Execute in a transaction. OpenFGA’s Postgres implementation uses an **initial lock phase** so concurrent writes do not conflict:

0. **Lock phase (recommended for concurrent writes):** Build a deduped, sorted list of tuple keys from `deletes` and `writes` (same key fields). Run `SELECT … FOR UPDATE` on those rows so the database holds row locks for the duration of the transaction. Use a stable key order (e.g. sort by object_type, object_id, relation, user_type, user_id, user_relation) to avoid deadlocks. If you do not have concurrent `WriteTuples` requests touching the same tuples, you can omit this step.

1. **Deletes:** remove rows matching each key for the store.
2. **Writes:** insert or replace rows (upsert) for each write; set condition_name/condition_ctx when present.
3. **Changelog:** append one changelog row per delete (operation = `delete`) and one per write (operation = `write`), with a new ulid and tuple_timestamp.

```sql
-- 0. Lock phase: select (and lock) existing rows for all keys in deletes + writes (deduped, sorted)
-- SELECT ... FROM tuple WHERE store_id = :store_id AND (object_type, object_id, relation, user_type, user_id, user_relation) IN ((...), (...)) FOR UPDATE;

-- 1. Delete (for each key in deletes)
DELETE FROM tuple
WHERE store_id = :store_id
  AND object_type = :object_type AND object_id = :object_id
  AND relation = :relation
  AND user_type = :user_type AND user_id = :user_id AND user_relation = :user_relation;

-- 2. Write (for each item in writes; use INSERT OR REPLACE / ON CONFLICT for upsert)
INSERT INTO tuple (store_id, object_type, object_id, relation, user_type, user_id, user_relation, condition_name, condition_ctx, inserted_at)
VALUES (:store_id, :object_type, :object_id, :relation, :user_type, :user_id, :user_relation, :condition_name, :condition_ctx, CURRENT_TIMESTAMP)
ON CONFLICT (store_id, object_type, object_id, relation, user_type, user_id, user_relation)
DO UPDATE SET condition_name = EXCLUDED.condition_name, condition_ctx = EXCLUDED.condition_ctx, inserted_at = CURRENT_TIMESTAMP;

-- 3. Changelog (for each delete and each write; generate new ulid per row)
INSERT INTO changelog (store_id, ulid, operation, object_type, object_id, relation, user_type, user_id, user_relation, condition_name, condition_ctx, tuple_timestamp)
VALUES (:store_id, :ulid, 'write', :object_type, :object_id, :relation, :user_type, :user_id, :user_relation, :condition_name, :condition_ctx, CURRENT_TIMESTAMP);
```

### ReadTuples

**Request:** `store_id`, `object_type`, `object_id` (optional; empty means all objects of that type), `relation`, optional `user_filter` (exact user_type, user_id, user_relation), optional `user_type_filters`, `page_size`, `page_token`.

Forward lookup: list tuples for the given object (and relation). Restrict by user when `user_filter` or `user_type_filters` are set. Use `page_token` as an opaque cursor (e.g. last object_id + last user key) and limit to `page_size`.

```sql
-- Base: tuples for (store_id, object_type, object_id?, relation)
SELECT object_type, object_id, relation, user_type, user_id, user_relation, condition_name, condition_ctx, inserted_at
FROM tuple
WHERE store_id = :store_id
  AND object_type = :object_type
  AND (:object_id = '' OR object_id = :object_id)
  AND relation = :relation
  AND (:user_type = '' OR (user_type = :user_type AND user_id = :user_id AND user_relation = :user_relation))
  -- If user_type_filters: AND (user_type, user_relation) IN ((:ut1, :ur1), ...)
ORDER BY object_id, user_type, user_id, user_relation
LIMIT :page_size + 1;
-- If more than page_size rows, next page_token = last (object_id, user_type, user_id, user_relation) of the returned page.
```

If your schema uses a single `object` column (e.g. `object_type:object_id`), filter with `object LIKE :object_type || ':%'` when `object_id` is empty, or `object = :object` when both type and id are set.

### ReadTuplesByUser

**Request:** `store_id`, `users[]` (each: user_type, user_id, user_relation), `object_type`, `relation`, optional `object_ids[]`, optional `condition_names[]`, `sort_ascending`.

Reverse lookup: list tuples where the “user” is in the given list. Optionally filter by object_ids and condition names. Order by object (and optionally user) ascending or descending.

```sql
-- Tuples where (user_type, user_id, user_relation) IN users, for object_type and relation
SELECT object_type, object_id, relation, user_type, user_id, user_relation, condition_name, condition_ctx, inserted_at
FROM tuple
WHERE store_id = :store_id
  AND (user_type, user_id, user_relation) IN ((:u1_type, :u1_id, :u1_rel), (:u2_type, :u2_id, :u2_rel), ...)
  AND object_type = :object_type
  AND relation = :relation
  -- If object_ids provided: AND object_id IN (...)
  -- If condition_names provided: AND (condition_name IN (...) OR ('' IN (...) AND condition_name IS NULL))
ORDER BY object_id ASC, user_type, user_id, user_relation;   -- or DESC when !sort_ascending
```

### ReadChanges

**Request:** `store_id`, optional `object_type`, `after_token` (opaque cursor, e.g. last ulid), `page_size`, `horizon_seconds`.

Return changelog entries after the cursor, newest first, excluding changes within the last `horizon_seconds`. Use `continuation_token` for the next page (e.g. last ulid of the current page).

```sql
-- Changelog after token, optional object_type filter, exclude recent by horizon
SELECT ulid, operation, object_type, object_id, relation, user_type, user_id, user_relation, condition_name, condition_ctx, tuple_timestamp
FROM changelog
WHERE store_id = :store_id
  AND (:object_type = '' OR object_type = :object_type)
  AND (:after_token = '' OR ulid < :after_token)
  AND tuple_timestamp <= CURRENT_TIMESTAMP - INTERVAL '1 second' * :horizon_seconds
ORDER BY ulid DESC
LIMIT :page_size + 1;
-- continuation_token = last ulid in this page (for next request as after_token).
```

Implementations that do not need Watch can return an empty `ReadChangesResponse`; the client handles that.

The SQL above is conceptual; adapt placeholders, upsert/conflict syntax, and date arithmetic to your database (e.g. PostgreSQL, MySQL, SQLite).

---

## Configuration

Tuple storage settings live under `[zanzana.server]` in `conf/custom.ini` (or environment variables). To use an external TupleStorageService:

To use an external TupleStorageService for tuples only:

1. Set `storage_mode = custom`.
2. Set `tuple_service_addr` to the gRPC address of your TupleStorageService (e.g. `localhost:50051`).
3. Optionally set `tuple_service_tls_cert` to a path to a TLS certificate if the service uses TLS.

**Example `conf/custom.ini`:**

```ini
[zanzana.server]
# Use an external gRPC service for tuple storage (stores/models/assertions stay in Grafana).
storage_mode = custom
tuple_service_addr = localhost:50051

# Optional: TLS certificate path when the tuple service uses TLS.
; tuple_service_tls_cert = /path/to/cert.pem
```

With this configuration, Grafana will:

- Create and manage **stores**, **authorization models**, and **assertions** in memory (or as configured).
- Send all **tuple** reads and writes to the gRPC service at `tuple_service_addr`.

The TupleStorageService must implement the proto defined in `pkg/services/authz/proto/v1/tuple_storage.proto` (WriteTuples, ReadTuples, ReadTuplesByUser, ReadChanges).

## Testing locally

1. **Run the demo tuple storage service**:

   ```bash
   go run ./pkg/cmd/tuple-storage-service/
   ```

   By default it uses **SQLite** with database file `tuple-storage.db` in the current directory and listens on `127.0.0.1:50051`. Options:

   - `-addr` – gRPC listen address (default `127.0.0.1:50051`)
   - `-storage` – `sqlite` (default, persistent) or `memory` (ephemeral)
   - `-db` – SQLite file path when using `-storage=sqlite` (default `tuple-storage.db`)

   Examples:

   ```bash
   go run ./pkg/cmd/tuple-storage-service/ -db ./data/tuples.db
   go run ./pkg/cmd/tuple-storage-service/ -storage memory
   ```

2. **Configure Grafana** in `conf/custom.ini`:

   ```ini
   [zanzana.server]
   storage_mode = custom
   tuple_service_addr = 127.0.0.1:50051
   ```

3. Start Grafana (in another terminal). It will connect to the tuple service at the given address.

The demo service uses the reference implementation (`TupleStorageSQLServer`). With the default SQLite backend, data is stored in the file given by `-db`. With `-storage memory`, data is lost when you stop the process.

## Proto and generated code

- Proto: `pkg/services/authz/proto/v1/tuple_storage.proto`
- Regenerate Go: from the repo root, run  
  `buf generate pkg/services/authz/proto/v1 --template pkg/services/authz/proto/v1/buf.gen.yaml`
