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
	Namespace   string
	Group       string
	Resource    string
	Name        string
	OlderThanRV int64
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
	Namespace      string
	Group          string
	Resource       string
	QueryEmbedding any // pgvector.HalfVector
	Limit          int64
	Response       *sqlEmbeddingsSearchResponse

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
