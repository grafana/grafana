package vector

import (
	"embed"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
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
	Vector    *Vector
	Embedding any // pgvector.HalfVector
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
	Namespace   string
	Model       string // empty means all models
	Group       string
	Resource    string
	Name        string
	OlderThanRV int64
}

func (r *sqlEmbeddingsDeleteRequest) HasModel() bool {
	return r.Model != ""
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

// MetadataFilterEntry is a pre-built JSONB containment filter for the search template.
type MetadataFilterEntry struct {
	JSON string // e.g. `{"datasource_uids":["ds1"]}`
}

type sqlEmbeddingsSearchRequest struct {
	sqltemplate.SQLTemplate
	Namespace      string
	Model          string
	Group          string
	Resource       string
	QueryEmbedding any // pgvector.HalfVector
	Limit          int64
	Response       *sqlEmbeddingsSearchResponse

	// Filters (nil means no filter)
	NameValues      []string
	FolderValues    []string
	MetadataFilters []MetadataFilterEntry
}

func (r *sqlEmbeddingsSearchRequest) Validate() error {
	if r.Namespace == "" || r.Model == "" || r.Group == "" || r.Resource == "" {
		return fmt.Errorf("missing required fields")
	}
	if r.Limit <= 0 {
		return fmt.Errorf("limit must be positive")
	}
	return nil
}

func (r *sqlEmbeddingsSearchRequest) Results() (*sqlEmbeddingsSearchResponse, error) {
	// Set-returning query: return a copy because Response is reused for each
	// Scan call. Scan allocates a fresh []byte for Metadata, so a shallow copy
	// is safe.
	cp := *r.Response
	return &cp, nil
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

// -- GetLatestRV request --

type sqlEmbeddingsGetLatestRVResponse struct {
	ResourceVersion int64
}

type sqlEmbeddingsGetLatestRVRequest struct {
	sqltemplate.SQLTemplate
	Namespace string
	Model     string
	Response  *sqlEmbeddingsGetLatestRVResponse
}

func (r *sqlEmbeddingsGetLatestRVRequest) Validate() error {
	if r.Namespace == "" || r.Model == "" {
		return fmt.Errorf("missing required fields")
	}
	return nil
}

func (r *sqlEmbeddingsGetLatestRVRequest) Results() (*sqlEmbeddingsGetLatestRVResponse, error) {
	return r.Response, nil
}

// -- CreatePartition request --

// sqlEmbeddingsCreatePartitionRequest builds the nested partitions for one
// (namespace, model) pair. PostgreSQL's LIST partitioning only accepts a single
// column, so we partition by namespace at level 1 and sub-partition by model at
// level 2.
type sqlEmbeddingsCreatePartitionRequest struct {
	sqltemplate.SQLTemplate
	Namespace              string
	Model                  string
	NamespacePartitionName string // level-1 table, e.g. "resource_embeddings_stacks_123"
	ModelPartitionName     string // level-2 leaf table, e.g. "resource_embeddings_stacks_123__text_embedding_005"
}

func (r *sqlEmbeddingsCreatePartitionRequest) Validate() error {
	if r.Namespace == "" || r.Model == "" ||
		r.NamespacePartitionName == "" || r.ModelPartitionName == "" {
		return fmt.Errorf("missing required fields")
	}
	return nil
}

// NamespaceLiteral returns the namespace as a PostgreSQL string literal.
// PostgreSQL does not accept bind parameters in CREATE TABLE ... FOR VALUES IN (...),
// so the value must be inlined as a constant.
func (r *sqlEmbeddingsCreatePartitionRequest) NamespaceLiteral() string {
	return "'" + strings.ReplaceAll(r.Namespace, "'", "''") + "'"
}

// ModelLiteral returns the model as a PostgreSQL string literal. See
// NamespaceLiteral for the constraint that forces literal inlining.
func (r *sqlEmbeddingsCreatePartitionRequest) ModelLiteral() string {
	return "'" + strings.ReplaceAll(r.Model, "'", "''") + "'"
}
