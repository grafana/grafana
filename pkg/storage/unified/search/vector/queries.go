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
	sqlVectorCollectionUpsert            = mustTemplate("vector_collection_upsert.sql")
	sqlVectorCollectionDelete            = mustTemplate("vector_collection_delete.sql")
	sqlVectorCollectionDeleteSubresource = mustTemplate("vector_collection_delete_subresources.sql")
	sqlVectorCollectionGetContent        = mustTemplate("vector_collection_get_content.sql")
	sqlVectorCollectionSearch            = mustTemplate("vector_collection_search.sql")
)

// All queries target `embeddings` and include `resource = $1 AND
// namespace = $2` so nested partition pruning routes to one leaf.

type sqlVectorCollectionUpsertRequest struct {
	sqltemplate.SQLTemplate
	Resource  string
	Vector    *Vector
	Embedding any // pgvector.HalfVector
}

func (r *sqlVectorCollectionUpsertRequest) Validate() error {
	if r.Resource == "" {
		return fmt.Errorf("missing resource")
	}
	if r.Vector == nil {
		return fmt.Errorf("missing vector")
	}
	return nil
}

type sqlVectorCollectionDeleteRequest struct {
	sqltemplate.SQLTemplate
	Resource  string
	Namespace string
	Model     string
	UID       string
}

func (r *sqlVectorCollectionDeleteRequest) Validate() error {
	if r.Resource == "" || r.Namespace == "" || r.Model == "" || r.UID == "" {
		return fmt.Errorf("missing required fields")
	}
	return nil
}

type sqlVectorCollectionDeleteSubresourcesRequest struct {
	sqltemplate.SQLTemplate
	Resource     string
	Namespace    string
	Model        string
	UID          string
	Subresources []string
}

func (r *sqlVectorCollectionDeleteSubresourcesRequest) Validate() error {
	if r.Resource == "" || r.Namespace == "" || r.Model == "" || r.UID == "" {
		return fmt.Errorf("missing required fields")
	}
	if len(r.Subresources) == 0 {
		return fmt.Errorf("subresources must not be empty")
	}
	return nil
}

func (r *sqlVectorCollectionDeleteSubresourcesRequest) SubresourcesSlice() reflect.Value {
	return reflect.ValueOf(r.Subresources)
}

type sqlVectorCollectionGetContentResponse struct {
	Subresource string
	Content     string
}

type sqlVectorCollectionGetContentRequest struct {
	sqltemplate.SQLTemplate
	Resource  string
	Namespace string
	Model     string
	UID       string
	Response  *sqlVectorCollectionGetContentResponse
}

func (r *sqlVectorCollectionGetContentRequest) Validate() error {
	if r.Resource == "" || r.Namespace == "" || r.Model == "" || r.UID == "" {
		return fmt.Errorf("missing required fields")
	}
	return nil
}

func (r *sqlVectorCollectionGetContentRequest) Results() (*sqlVectorCollectionGetContentResponse, error) {
	cp := *r.Response
	return &cp, nil
}

type sqlVectorCollectionSearchResponse struct {
	UID         string
	Title       string
	Subresource string
	Content     string
	Score       float64
	Folder      string
	Metadata    json.RawMessage
}

// MetadataFilterEntry is a pre-built JSONB containment filter.
type MetadataFilterEntry struct {
	JSON string // e.g. `{"datasource_uids":["ds1"]}`
}

type sqlVectorCollectionSearchRequest struct {
	sqltemplate.SQLTemplate
	Resource       string
	Namespace      string
	Model          string
	QueryEmbedding any // pgvector.HalfVector
	Limit          int64
	Response       *sqlVectorCollectionSearchResponse

	// nil/empty means no filter on that field.
	UIDValues       []string
	FolderValues    []string
	MetadataFilters []MetadataFilterEntry
}

func (r *sqlVectorCollectionSearchRequest) Validate() error {
	if r.Resource == "" || r.Namespace == "" || r.Model == "" {
		return fmt.Errorf("missing required fields")
	}
	if r.Limit <= 0 {
		return fmt.Errorf("limit must be positive")
	}
	return nil
}

func (r *sqlVectorCollectionSearchRequest) Results() (*sqlVectorCollectionSearchResponse, error) {
	// Response is reused across Scan calls; shallow copy is safe because Scan
	// allocates a fresh []byte for Metadata.
	cp := *r.Response
	return &cp, nil
}

func (r *sqlVectorCollectionSearchRequest) UIDFilter() bool {
	return len(r.UIDValues) > 0
}

func (r *sqlVectorCollectionSearchRequest) UIDFilterSlice() reflect.Value {
	return reflect.ValueOf(r.UIDValues)
}

func (r *sqlVectorCollectionSearchRequest) FolderFilter() bool {
	return len(r.FolderValues) > 0
}

func (r *sqlVectorCollectionSearchRequest) FolderFilterSlice() reflect.Value {
	return reflect.ValueOf(r.FolderValues)
}
