# Vector Search PR 1: VectorBackend + pgvector Storage Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the storage foundation for vector search -- a `VectorBackend` interface, pgvector-backed implementation, schema initialization, config parsing, and SQL templates following existing unified storage patterns.

**Architecture:** New `pkg/storage/unified/search/vector/` package containing the `VectorBackend` interface, a `pgvectorBackend` implementation using the sqltemplate pattern (`.sql` templates, request structs, `dbutil` execution). The pgvector database is separate from Grafana's main database, configured under `[unified_storage.vector-storage]`. Schema is managed by the backend on startup with idempotent DDL.

**Tech Stack:** Go, PostgreSQL, pgvector extension, `github.com/pgvector/pgvector-go`, existing `sqltemplate`/`dbutil` packages.

---

### Task 1: Configuration -- parse `[unified_storage.vector-storage]` INI section

**Files:**
- Modify: `pkg/setting/setting.go` (add fields near line 680)
- Modify: `pkg/setting/setting_unified_storage.go` (add parsing in `setUnifiedStorageConfig()`)
- Modify: `pkg/setting/setting_unified_storage_test.go`

- [ ] **Step 1: Add Cfg fields**

In `pkg/setting/setting.go`, add these fields after the `SearchInjectFailuresPercent` block (around line 681):

```go
// Vector storage (separate pgvector database)
VectorDBHost     string
VectorDBName     string
VectorDBUser     string
VectorDBPassword string
VectorDBSSLMode  string
```

- [ ] **Step 2: Parse config section**

In `pkg/setting/setting_unified_storage.go`, add parsing at the end of `setUnifiedStorageConfig()`, before the closing `}`:

```go
// Vector storage config (separate pgvector database)
vectorSection := cfg.Raw.Section("unified_storage.vector-storage")
cfg.VectorDBHost = vectorSection.Key("db_host").String()
cfg.VectorDBName = vectorSection.Key("db_name").String()
cfg.VectorDBUser = vectorSection.Key("db_user").String()
cfg.VectorDBPassword = vectorSection.Key("db_password").String()
cfg.VectorDBSSLMode = vectorSection.Key("db_sslmode").MustString("disable")
```

- [ ] **Step 3: Write test for config parsing**

In `pkg/setting/setting_unified_storage_test.go`, add:

```go
func TestVectorStorageConfig(t *testing.T) {
	cfg := setting.NewCfg()
	vectorSection, err := cfg.Raw.NewSection("unified_storage.vector-storage")
	require.NoError(t, err)
	vectorSection.NewKey("db_host", "vectordb:5432")
	vectorSection.NewKey("db_name", "grafana_vectors")
	vectorSection.NewKey("db_user", "vecuser")
	vectorSection.NewKey("db_password", "vecpass")
	vectorSection.NewKey("db_sslmode", "require")

	cfg.setUnifiedStorageConfig() // may need to be exported or tested via public path

	assert.Equal(t, "vectordb:5432", cfg.VectorDBHost)
	assert.Equal(t, "grafana_vectors", cfg.VectorDBName)
	assert.Equal(t, "vecuser", cfg.VectorDBUser)
	assert.Equal(t, "vecpass", cfg.VectorDBPassword)
	assert.Equal(t, "require", cfg.VectorDBSSLMode)
}
```

- [ ] **Step 4: Run test**

Run: `go test -run TestVectorStorageConfig ./pkg/setting/...`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pkg/setting/setting.go pkg/setting/setting_unified_storage.go pkg/setting/setting_unified_storage_test.go
git commit -m "feat(unified-storage): add vector-storage database config section"
```

---

### Task 2: VectorBackend interface and types

**Files:**
- Create: `pkg/storage/unified/search/vector/store.go`

- [ ] **Step 1: Create the package and interface file**

Create `pkg/storage/unified/search/vector/store.go`:

```go
package vector

import (
	"context"
	"encoding/json"
)

// VectorBackend abstracts vector storage operations. The pgvector implementation
// is the only backend for now, but the interface allows testing with mocks.
type VectorBackend interface {
	// Search performs vector similarity search with optional metadata filtering.
	Search(ctx context.Context, namespace, group, resource string,
		embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error)

	// Upsert inserts or updates vectors. Vectors are grouped by namespace internally.
	Upsert(ctx context.Context, vectors []Vector) error

	// Delete removes vectors for a resource. If olderThanRV > 0, only deletes
	// vectors with resource_version < olderThanRV (stale panel cleanup after update).
	// If olderThanRV == 0, deletes all vectors for the resource (full delete).
	Delete(ctx context.Context, namespace, group, resource, name string, olderThanRV int64) error

	// GetLatestRV returns the maximum resource_version stored for a namespace.
	// Returns 0 if no vectors exist. Used by the write pipeline to resume polling.
	GetLatestRV(ctx context.Context, namespace string) (int64, error)
}

// Vector represents a single embeddable subresource (e.g. one dashboard panel).
type Vector struct {
	Namespace       string
	Group           string          // API group, e.g. "dashboard.grafana.app"
	Resource        string          // resource type, e.g. "dashboards"
	Name            string          // resource name (e.g. dashboard UID)
	Subresource     string          // unique subresource ID, e.g. "panel/5"
	ResourceVersion int64           // RV at time of embedding
	Folder          string          // folder UID for authz filtering
	Content         string          // text that was embedded
	Metadata        json.RawMessage // structured fields for filtering (JSONB)
	Embedding       []float32       // vector embedding
	Model           string          // embedding model name, e.g. "text-embedding-005"
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

// SearchFilter constrains vector search results.
// Field is either a top-level column ("name", "folder") or a JSONB metadata
// key ("datasource_uids", "query_languages").
type SearchFilter struct {
	Field  string
	Values []string
}
```

- [ ] **Step 2: Verify it compiles**

Run: `go build ./pkg/storage/unified/search/vector/...`
Expected: Success (no errors)

- [ ] **Step 3: Commit**

```bash
git add pkg/storage/unified/search/vector/store.go
git commit -m "feat(unified-storage): add VectorBackend interface and types"
```

---

### Task 3: Schema initialization

**Files:**
- Create: `pkg/storage/unified/search/vector/schema.go`
- Create: `pkg/storage/unified/search/vector/schema.sql`

Note: `schema.sql` lives in the package root (not `data/`) so it is NOT picked up by the `//go:embed data/*.sql` template FS in queries.go. The `data/` directory is exclusively for SQL templates.

- [ ] **Step 1: Create the embedded schema DDL**

Create `pkg/storage/unified/search/vector/schema.sql`:

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
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS resource_embeddings_metadata_idx
    ON resource_embeddings USING GIN (metadata);
```

- [ ] **Step 2: Create schema.go to run DDL on startup**

Create `pkg/storage/unified/search/vector/schema.go`:

```go
package vector

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
)

//go:embed schema.sql
var schemaDDL string

// InitSchema runs idempotent DDL against the vector database to ensure the
// resource_embeddings table and its indexes exist.
func InitSchema(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, schemaDDL)
	if err != nil {
		return fmt.Errorf("init vector schema: %w", err)
	}
	return nil
}
```

- [ ] **Step 3: Verify it compiles**

Run: `go build ./pkg/storage/unified/search/vector/...`
Expected: Success

- [ ] **Step 4: Commit**

```bash
git add pkg/storage/unified/search/vector/schema.go pkg/storage/unified/search/vector/schema.sql
git commit -m "feat(unified-storage): add pgvector schema DDL and init"
```

---

### Task 4: SQL templates and request structs

**Files:**
- Create: `pkg/storage/unified/search/vector/queries.go`
- Create: `pkg/storage/unified/search/vector/data/resource_embeddings_upsert.sql`
- Create: `pkg/storage/unified/search/vector/data/resource_embeddings_delete.sql`
- Create: `pkg/storage/unified/search/vector/data/resource_embeddings_search.sql`
- Create: `pkg/storage/unified/search/vector/data/resource_embeddings_get_latest_rv.sql`
- Create: `pkg/storage/unified/search/vector/data/resource_embeddings_create_partition.sql`

- [ ] **Step 1: Create the upsert SQL template**

Create `pkg/storage/unified/search/vector/data/resource_embeddings_upsert.sql`:

```sql
INSERT INTO {{ .Ident "resource_embeddings" }} (
    {{ .Ident "namespace" }},
    {{ .Ident "group" }},
    {{ .Ident "resource" }},
    {{ .Ident "name" }},
    {{ .Ident "subresource" }},
    {{ .Ident "resource_version" }},
    {{ .Ident "folder" }},
    {{ .Ident "content" }},
    {{ .Ident "metadata" }},
    {{ .Ident "embedding" }},
    {{ .Ident "model" }}
)
VALUES (
    {{ .Arg .Vector.Namespace }},
    {{ .Arg .Vector.Group }},
    {{ .Arg .Vector.Resource }},
    {{ .Arg .Vector.Name }},
    {{ .Arg .Vector.Subresource }},
    {{ .Arg .Vector.ResourceVersion }},
    {{ .Arg .Vector.Folder }},
    {{ .Arg .Vector.Content }},
    {{ .Arg .Vector.Metadata }},
    {{ .Arg .Vector.Embedding }},
    {{ .Arg .Vector.Model }}
)
ON CONFLICT ({{ .Ident "namespace" }}, {{ .Ident "group" }}, {{ .Ident "resource" }}, {{ .Ident "name" }}, {{ .Ident "subresource" }})
DO UPDATE SET
    {{ .Ident "resource_version" }} = {{ .Arg .Vector.ResourceVersion }},
    {{ .Ident "folder" }}           = {{ .Arg .Vector.Folder }},
    {{ .Ident "content" }}          = {{ .Arg .Vector.Content }},
    {{ .Ident "metadata" }}         = {{ .Arg .Vector.Metadata }},
    {{ .Ident "embedding" }}        = {{ .Arg .Vector.Embedding }},
    {{ .Ident "model" }}            = {{ .Arg .Vector.Model }}
;
```

- [ ] **Step 2: Create the delete SQL template**

Create `pkg/storage/unified/search/vector/data/resource_embeddings_delete.sql`:

```sql
DELETE FROM {{ .Ident "resource_embeddings" }}
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "group" }}       = {{ .Arg .Group }}
    AND {{ .Ident "resource" }}    = {{ .Arg .Resource }}
    AND {{ .Ident "name" }}        = {{ .Arg .Name }}
    {{ if .HasOlderThanRV }}
    AND {{ .Ident "resource_version" }} < {{ .Arg .OlderThanRV }}
    {{ end }}
;
```

- [ ] **Step 3: Create the search SQL template**

Create `pkg/storage/unified/search/vector/data/resource_embeddings_search.sql`:

```sql
SELECT
    {{ .Ident "name" | .Into .Response.Name }},
    {{ .Ident "subresource" | .Into .Response.Subresource }},
    {{ .Ident "content" | .Into .Response.Content }},
    {{ .Ident "embedding" }} <=> {{ .Arg .QueryEmbedding }} AS {{ .Ident "score" | .Into .Response.Score }},
    {{ .Ident "folder" | .Into .Response.Folder }},
    {{ .Ident "metadata" | .Into .Response.Metadata }}
    FROM {{ .Ident "resource_embeddings" }}
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "group" }}       = {{ .Arg .Group }}
    AND {{ .Ident "resource" }}    = {{ .Arg .Resource }}
    {{ if .NameFilter }}
    AND {{ .Ident "name" }} IN ({{ .ArgList .NameFilterSlice }})
    {{ end }}
    {{ if .FolderFilter }}
    AND {{ .Ident "folder" }} IN ({{ .ArgList .FolderFilterSlice }})
    {{ end }}
    {{ if .DatasourceFilter }}
    AND {{ .Ident "metadata" }} @> {{ .Arg .DatasourceFilterJSON }}
    {{ end }}
    {{ if .LanguageFilter }}
    AND {{ .Ident "metadata" }} @> {{ .Arg .LanguageFilterJSON }}
    {{ end }}
    ORDER BY {{ .Ident "embedding" }} <=> {{ .Arg .QueryEmbedding }}
    LIMIT {{ .Arg .Limit }}
;
```

- [ ] **Step 4: Create the get_latest_rv SQL template**

Create `pkg/storage/unified/search/vector/data/resource_embeddings_get_latest_rv.sql`:

```sql
SELECT
    COALESCE(MAX({{ .Ident "resource_version" }}), 0) AS {{ .Ident "resource_version" | .Into .Response.ResourceVersion }}
    FROM {{ .Ident "resource_embeddings" }}
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
;
```

- [ ] **Step 5: Create the create_partition SQL template**

Create `pkg/storage/unified/search/vector/data/resource_embeddings_create_partition.sql`:

```sql
CREATE TABLE IF NOT EXISTS {{ .PartitionName }}
    PARTITION OF {{ .Ident "resource_embeddings" }}
    FOR VALUES IN ({{ .Arg .Namespace }})
;
```

- [ ] **Step 6: Create queries.go with template loading and request structs**

Create `pkg/storage/unified/search/vector/queries.go`:

```go
package vector

import (
	"embed"
	"encoding/json"
	"fmt"
	"reflect"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

//go:embed data/*.sql
var sqlTemplatesFS embed.FS

var sqlTemplates = template.Must(
	template.New("sql").ParseFS(sqlTemplatesFS, `data/*.sql`),
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

var (
	sqlEmbeddingsUpsert          = mustTemplate("resource_embeddings_upsert.sql")
	sqlEmbeddingsDelete          = mustTemplate("resource_embeddings_delete.sql")
	sqlEmbeddingsSearch          = mustTemplate("resource_embeddings_search.sql")
	sqlEmbeddingsGetLatestRV     = mustTemplate("resource_embeddings_get_latest_rv.sql")
	sqlEmbeddingsCreatePartition = mustTemplate("resource_embeddings_create_partition.sql")
)

// -- Upsert request --

type sqlEmbeddingsUpsertRequest struct {
	sqltemplate.SQLTemplate
	Vector *Vector
}

func (r *sqlEmbeddingsUpsertRequest) Validate() error {
	if r.Vector == nil {
		return fmt.Errorf("missing vector")
	}
	if r.Vector.Namespace == "" {
		return fmt.Errorf("missing namespace")
	}
	return nil
}

// -- Delete request --

type sqlEmbeddingsDeleteRequest struct {
	sqltemplate.SQLTemplate
	Namespace    string
	Group        string
	Resource     string
	Name         string
	OlderThanRV  int64
}

func (r *sqlEmbeddingsDeleteRequest) HasOlderThanRV() bool {
	return r.OlderThanRV > 0
}

func (r *sqlEmbeddingsDeleteRequest) Validate() error {
	if r.Namespace == "" || r.Group == "" || r.Resource == "" || r.Name == "" {
		return fmt.Errorf("missing required fields")
	}
	return nil
}

// -- Search request --

type sqlEmbeddingsSearchResponse struct {
	Name        string
	Subresource string
	Content     string
	Score       float64
	Folder      string
	Metadata    json.RawMessage
}

type sqlEmbeddingsSearchRequest struct {
	sqltemplate.SQLTemplate
	Namespace     string
	Group         string
	Resource      string
	QueryEmbedding any // pgvector.HalfVector
	Limit         int64
	Response      *sqlEmbeddingsSearchResponse

	// Filters (nil means no filter)
	NameValues       []string
	FolderValues     []string
	DatasourceValues []string
	LanguageValues   []string
}

func (r *sqlEmbeddingsSearchRequest) Validate() error {
	if r.Namespace == "" || r.Group == "" || r.Resource == "" {
		return fmt.Errorf("missing required fields")
	}
	if r.Limit <= 0 {
		return fmt.Errorf("limit must be positive")
	}
	return nil
}

func (r *sqlEmbeddingsSearchRequest) Results() (*sqlEmbeddingsSearchResponse, error) {
	return r.Response, nil
}

func (r *sqlEmbeddingsSearchRequest) NameFilter() bool {
	return len(r.NameValues) > 0
}

func (r *sqlEmbeddingsSearchRequest) NameFilterSlice() reflect.Value {
	return reflect.ValueOf(r.NameValues)
}

func (r *sqlEmbeddingsSearchRequest) FolderFilter() bool {
	return len(r.FolderValues) > 0
}

func (r *sqlEmbeddingsSearchRequest) FolderFilterSlice() reflect.Value {
	return reflect.ValueOf(r.FolderValues)
}

func (r *sqlEmbeddingsSearchRequest) DatasourceFilter() bool {
	return len(r.DatasourceValues) > 0
}

func (r *sqlEmbeddingsSearchRequest) DatasourceFilterJSON() string {
	b, _ := json.Marshal(map[string][]string{"datasource_uids": r.DatasourceValues})
	return string(b)
}

func (r *sqlEmbeddingsSearchRequest) LanguageFilter() bool {
	return len(r.LanguageValues) > 0
}

func (r *sqlEmbeddingsSearchRequest) LanguageFilterJSON() string {
	b, _ := json.Marshal(map[string][]string{"query_languages": r.LanguageValues})
	return string(b)
}

// -- GetLatestRV request --

type sqlEmbeddingsGetLatestRVResponse struct {
	ResourceVersion int64
}

type sqlEmbeddingsGetLatestRVRequest struct {
	sqltemplate.SQLTemplate
	Namespace string
	Response  *sqlEmbeddingsGetLatestRVResponse
}

func (r *sqlEmbeddingsGetLatestRVRequest) Validate() error {
	if r.Namespace == "" {
		return fmt.Errorf("missing namespace")
	}
	return nil
}

func (r *sqlEmbeddingsGetLatestRVRequest) Results() (*sqlEmbeddingsGetLatestRVResponse, error) {
	return r.Response, nil
}

// -- CreatePartition request --

type sqlEmbeddingsCreatePartitionRequest struct {
	sqltemplate.SQLTemplate
	Namespace     string
	PartitionName string // pre-sanitized table name, e.g. "resource_embeddings_stacks_123"
}

func (r *sqlEmbeddingsCreatePartitionRequest) Validate() error {
	if r.Namespace == "" || r.PartitionName == "" {
		return fmt.Errorf("missing required fields")
	}
	return nil
}
```

- [ ] **Step 7: Verify it compiles**

Run: `go build ./pkg/storage/unified/search/vector/...`
Expected: Success

- [ ] **Step 8: Commit**

```bash
git add pkg/storage/unified/search/vector/queries.go pkg/storage/unified/search/vector/data/
git commit -m "feat(unified-storage): add vector SQL templates and request structs"
```

---

### Task 5: SQL template snapshot tests

**Files:**
- Create: `pkg/storage/unified/search/vector/queries_test.go`
- Generated: `pkg/storage/unified/search/vector/testdata/*.sql` (auto-created on first run)

- [ ] **Step 1: Create snapshot tests**

Create `pkg/storage/unified/search/vector/queries_test.go`:

```go
package vector

import (
	"encoding/json"
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestVectorQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Dialects:       []sqltemplate.Dialect{sqltemplate.PostgreSQL},
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlEmbeddingsUpsert: {
				{
					Name: "simple",
					Data: &sqlEmbeddingsUpsertRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Vector: &Vector{
							Namespace:       "stacks-123",
							Group:           "dashboard.grafana.app",
							Resource:        "dashboards",
							Name:            "abc-uid",
							Subresource:     "panel/5",
							ResourceVersion: 42,
							Folder:          "folder-uid",
							Content:         "panel title with queries",
							Metadata:        json.RawMessage(`{"datasource_uids":["ds1"]}`),
							Embedding:       []float32{0.1, 0.2, 0.3},
							Model:           "text-embedding-005",
						},
					},
				},
			},
			sqlEmbeddingsDelete: {
				{
					Name: "delete all",
					Data: &sqlEmbeddingsDeleteRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
						Group:       "dashboard.grafana.app",
						Resource:    "dashboards",
						Name:        "abc-uid",
						OlderThanRV: 0,
					},
				},
				{
					Name: "delete stale",
					Data: &sqlEmbeddingsDeleteRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
						Group:       "dashboard.grafana.app",
						Resource:    "dashboards",
						Name:        "abc-uid",
						OlderThanRV: 42,
					},
				},
			},
			sqlEmbeddingsSearch: {
				{
					Name: "no filters",
					Data: &sqlEmbeddingsSearchRequest{
						SQLTemplate:    mocks.NewTestingSQLTemplate(),
						Namespace:      "stacks-123",
						Group:          "dashboard.grafana.app",
						Resource:       "dashboards",
						QueryEmbedding: []float32{0.1, 0.2, 0.3},
						Limit:          10,
						Response:       &sqlEmbeddingsSearchResponse{},
					},
				},
				{
					Name: "with name filter",
					Data: &sqlEmbeddingsSearchRequest{
						SQLTemplate:    mocks.NewTestingSQLTemplate(),
						Namespace:      "stacks-123",
						Group:          "dashboard.grafana.app",
						Resource:       "dashboards",
						QueryEmbedding: []float32{0.1, 0.2, 0.3},
						Limit:          10,
						NameValues:     []string{"dash-1", "dash-2"},
						Response:       &sqlEmbeddingsSearchResponse{},
					},
				},
				{
					Name: "with all filters",
					Data: &sqlEmbeddingsSearchRequest{
						SQLTemplate:      mocks.NewTestingSQLTemplate(),
						Namespace:        "stacks-123",
						Group:            "dashboard.grafana.app",
						Resource:         "dashboards",
						QueryEmbedding:   []float32{0.1, 0.2, 0.3},
						Limit:            5,
						NameValues:       []string{"dash-1"},
						FolderValues:     []string{"folder-a", "folder-b"},
						DatasourceValues: []string{"ds-uid-1"},
						LanguageValues:   []string{"promql"},
						Response:         &sqlEmbeddingsSearchResponse{},
					},
				},
			},
			sqlEmbeddingsGetLatestRV: {
				{
					Name: "simple",
					Data: &sqlEmbeddingsGetLatestRVRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
						Response:    &sqlEmbeddingsGetLatestRVResponse{},
					},
				},
			},
			sqlEmbeddingsCreatePartition: {
				{
					Name: "simple",
					Data: &sqlEmbeddingsCreatePartitionRequest{
						SQLTemplate:   mocks.NewTestingSQLTemplate(),
						Namespace:     "stacks-123",
						PartitionName: "resource_embeddings_stacks_123",
					},
				},
			},
		},
	})
}
```

- [ ] **Step 2: Create testdata directory and run tests to generate snapshots**

```bash
mkdir -p pkg/storage/unified/search/vector/testdata
```

Run: `go test -run TestVectorQueries ./pkg/storage/unified/search/vector/...`
Expected: First run creates snapshot files in `testdata/` and reports them as errors. Second run should PASS.

Run again: `go test -run TestVectorQueries ./pkg/storage/unified/search/vector/...`
Expected: PASS

- [ ] **Step 3: Review generated snapshots**

Verify the generated files in `pkg/storage/unified/search/vector/testdata/` look correct. There should be one file per (dialect, template, test case) combination, all with `postgres--` prefix.

- [ ] **Step 4: Commit**

```bash
git add pkg/storage/unified/search/vector/queries_test.go pkg/storage/unified/search/vector/testdata/
git commit -m "test(unified-storage): add vector SQL template snapshot tests"
```

---

### Task 6: pgvectorBackend implementation

**Files:**
- Create: `pkg/storage/unified/search/vector/pgvector.go`

- [ ] **Step 1: Add pgvector-go dependency**

Run:
```bash
cd /Users/owensmallwood/work/grafana && go get github.com/pgvector/pgvector-go
```

- [ ] **Step 2: Create pgvector.go**

Create `pkg/storage/unified/search/vector/pgvector.go`:

```go
package vector

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strings"
	"sync"

	pgvector "github.com/pgvector/pgvector-go"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	_ VectorBackend = (*pgvectorBackend)(nil)

	// sanitizeRe replaces non-alphanumeric characters with underscores for partition names.
	sanitizeRe = regexp.MustCompile(`[^a-zA-Z0-9]`)
)

type pgvectorBackend struct {
	db         *sql.DB
	dialect    sqltemplate.Dialect
	partitions sync.Map // namespace -> struct{}
	log        log.Logger
}

func NewPgvectorBackend(db *sql.DB) *pgvectorBackend {
	return &pgvectorBackend{
		db:      db,
		dialect: sqltemplate.PostgreSQL,
		log:     log.New("vector-pgvector"),
	}
}

func (b *pgvectorBackend) Upsert(ctx context.Context, vectors []Vector) error {
	if len(vectors) == 0 {
		return nil
	}

	// Group by namespace to ensure partitions exist.
	byNamespace := make(map[string][]Vector)
	for i := range vectors {
		byNamespace[vectors[i].Namespace] = append(byNamespace[vectors[i].Namespace], vectors[i])
	}

	tx, err := b.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	for ns, vecs := range byNamespace {
		if err = b.ensurePartition(ctx, tx, ns); err != nil {
			return fmt.Errorf("ensure partition for %q: %w", ns, err)
		}
		for i := range vecs {
			req := &sqlEmbeddingsUpsertRequest{
				SQLTemplate: sqltemplate.New(b.dialect),
				Vector:      &vecs[i],
			}
			// Convert []float32 embedding to pgvector HalfVector for the driver.
			req.Vector.Embedding = vecs[i].Embedding
			if _, err = dbutil.Exec(ctx, tx, sqlEmbeddingsUpsert, req); err != nil {
				return fmt.Errorf("upsert vector %s/%s: %w", vecs[i].Name, vecs[i].Subresource, err)
			}
		}
	}

	err = tx.Commit()
	return err
}

func (b *pgvectorBackend) Delete(ctx context.Context, namespace, group, resource, name string, olderThanRV int64) error {
	req := &sqlEmbeddingsDeleteRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   namespace,
		Group:       group,
		Resource:    resource,
		Name:        name,
		OlderThanRV: olderThanRV,
	}
	_, err := dbutil.Exec(ctx, b.db, sqlEmbeddingsDelete, req)
	return err
}

func (b *pgvectorBackend) Search(ctx context.Context, namespace, group, resource string,
	embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error) {

	req := &sqlEmbeddingsSearchRequest{
		SQLTemplate:    sqltemplate.New(b.dialect),
		Namespace:      namespace,
		Group:          group,
		Resource:       resource,
		QueryEmbedding: pgvector.NewHalfVector(embedding),
		Limit:          int64(limit),
		Response:       &sqlEmbeddingsSearchResponse{},
	}

	for _, f := range filters {
		switch f.Field {
		case "name":
			req.NameValues = f.Values
		case "folder":
			req.FolderValues = f.Values
		case "datasource_uids":
			req.DatasourceValues = f.Values
		case "query_languages":
			req.LanguageValues = f.Values
		}
	}

	rows, err := dbutil.Query(ctx, b.db, sqlEmbeddingsSearch, req)
	if err != nil {
		return nil, err
	}

	results := make([]VectorSearchResult, len(rows))
	for i, row := range rows {
		results[i] = VectorSearchResult{
			Name:        row.Name,
			Subresource: row.Subresource,
			Content:     row.Content,
			Score:       row.Score,
			Folder:      row.Folder,
			Metadata:    row.Metadata,
		}
	}
	return results, nil
}

func (b *pgvectorBackend) GetLatestRV(ctx context.Context, namespace string) (int64, error) {
	req := &sqlEmbeddingsGetLatestRVRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   namespace,
		Response:    &sqlEmbeddingsGetLatestRVResponse{},
	}

	row, err := dbutil.QueryRow(ctx, b.db, sqlEmbeddingsGetLatestRV, req)
	if err != nil {
		return 0, err
	}
	return row.ResourceVersion, nil
}

// ensurePartition creates a partition for the given namespace if it doesn't
// already exist in the sync.Map cache. The DDL is idempotent.
func (b *pgvectorBackend) ensurePartition(ctx context.Context, execer dbutil.ContextExecer, namespace string) error {
	if _, ok := b.partitions.Load(namespace); ok {
		return nil
	}

	partitionName := sanitizePartitionName(namespace)
	req := &sqlEmbeddingsCreatePartitionRequest{
		SQLTemplate:   sqltemplate.New(b.dialect),
		Namespace:     namespace,
		PartitionName: partitionName,
	}
	if _, err := dbutil.Exec(ctx, execer, sqlEmbeddingsCreatePartition, req); err != nil {
		return err
	}

	b.partitions.Store(namespace, struct{}{})
	return nil
}

func sanitizePartitionName(namespace string) string {
	sanitized := strings.ToLower(sanitizeRe.ReplaceAllString(namespace, "_"))
	return "resource_embeddings_" + sanitized
}
```

- [ ] **Step 3: Verify it compiles**

Run: `go build ./pkg/storage/unified/search/vector/...`
Expected: Success

- [ ] **Step 4: Commit**

```bash
git add pkg/storage/unified/search/vector/pgvector.go go.mod go.sum
git commit -m "feat(unified-storage): add pgvectorBackend implementation"
```

---

### Task 7: pgvectorBackend unit tests

**Files:**
- Create: `pkg/storage/unified/search/vector/pgvector_test.go`

- [ ] **Step 1: Create unit tests**

Create `pkg/storage/unified/search/vector/pgvector_test.go`:

```go
package vector

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
)

func TestPgvectorBackend_Delete(t *testing.T) {
	t.Parallel()

	t.Run("delete all vectors for a resource", func(t *testing.T) {
		dbp := test.NewDBProviderMatchWords(t)
		backend := NewPgvectorBackend(dbp.DB.DB)

		dbp.ExecWithResult("delete resource_embeddings namespace group resource name", 0, 1)

		err := backend.Delete(context.Background(),
			"stacks-123", "dashboard.grafana.app", "dashboards", "abc-uid", 0)
		require.NoError(t, err)
	})

	t.Run("delete stale vectors", func(t *testing.T) {
		dbp := test.NewDBProviderMatchWords(t)
		backend := NewPgvectorBackend(dbp.DB.DB)

		dbp.ExecWithResult("delete resource_embeddings namespace group resource name resource_version", 0, 1)

		err := backend.Delete(context.Background(),
			"stacks-123", "dashboard.grafana.app", "dashboards", "abc-uid", 42)
		require.NoError(t, err)
	})
}

func TestPgvectorBackend_GetLatestRV(t *testing.T) {
	t.Parallel()

	dbp := test.NewDBProviderMatchWords(t)
	backend := NewPgvectorBackend(dbp.DB.DB)

	dbp.QueryWithResult("max resource_version resource_embeddings namespace",
		1, // number of columns
		[][]any{{int64(99)}},
	)

	rv, err := backend.GetLatestRV(context.Background(), "stacks-123")
	require.NoError(t, err)
	assert.Equal(t, int64(99), rv)
}

func TestSanitizePartitionName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input    string
		expected string
	}{
		{"stacks-123", "resource_embeddings_stacks_123"},
		{"default", "resource_embeddings_default"},
		{"org.with.dots", "resource_embeddings_org_with_dots"},
		{"UPPER-case", "resource_embeddings_upper_case"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			assert.Equal(t, tt.expected, sanitizePartitionName(tt.input))
		})
	}
}

func TestPgvectorBackend_Upsert_EmptySlice(t *testing.T) {
	t.Parallel()

	dbp := test.NewDBProviderMatchWords(t)
	backend := NewPgvectorBackend(dbp.DB.DB)

	err := backend.Upsert(context.Background(), nil)
	require.NoError(t, err)
}

func TestVector_MetadataJSON(t *testing.T) {
	t.Parallel()

	meta := map[string][]string{
		"datasource_uids": {"ds1", "ds2"},
		"query_languages": {"promql"},
	}
	b, err := json.Marshal(meta)
	require.NoError(t, err)

	v := Vector{Metadata: b}
	var parsed map[string][]string
	require.NoError(t, json.Unmarshal(v.Metadata, &parsed))
	assert.Equal(t, meta, parsed)
}
```

- [ ] **Step 2: Run tests**

Run: `go test -run TestPgvector ./pkg/storage/unified/search/vector/... -v`
Expected: PASS (or adjust mock expectations if the SQL word matching needs tuning)

Run: `go test -run TestSanitize ./pkg/storage/unified/search/vector/... -v`
Expected: PASS

Run: `go test -run TestVector_MetadataJSON ./pkg/storage/unified/search/vector/... -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add pkg/storage/unified/search/vector/pgvector_test.go
git commit -m "test(unified-storage): add pgvectorBackend unit tests"
```

---

### Task 8: Verify full package builds and all tests pass

**Files:** None (verification only)

- [ ] **Step 1: Run all tests in the vector package**

Run: `go test ./pkg/storage/unified/search/vector/... -v`
Expected: All tests PASS

- [ ] **Step 2: Run the linter**

Run: `make lint-go 2>&1 | grep -A2 "search/vector" || echo "no lint issues in vector package"`
Expected: No lint issues

- [ ] **Step 3: Verify the broader unified storage package still compiles**

Run: `go build ./pkg/storage/unified/...`
Expected: Success

- [ ] **Step 4: Final commit if any fixups were needed**

Only if previous steps required adjustments.
