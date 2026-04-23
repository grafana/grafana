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
	sqlVectorCollectionCreateTable       = mustTemplate("vector_collection_create_table.sql")
	sqlVectorCollectionUpsert            = mustTemplate("vector_collection_upsert.sql")
	sqlVectorCollectionDelete            = mustTemplate("vector_collection_delete.sql")
	sqlVectorCollectionDeleteSubresource = mustTemplate("vector_collection_delete_subresources.sql")
	sqlVectorCollectionGetContent        = mustTemplate("vector_collection_get_content.sql")
	sqlVectorCollectionSearch            = mustTemplate("vector_collection_search.sql")
)

// -- Create table request --

// sqlVectorCollectionCreateTableRequest renders the DDL for a single per-collection
// vec_<id> table plus its HNSW and GIN indexes. Table and index names are
// computed Go-side from the catalog id (vec_<id>, vec_<id>_hnsw, vec_<id>_metadata)
// and inlined raw; they're always valid identifiers because the id is an integer.
type sqlVectorCollectionCreateTableRequest struct {
	sqltemplate.SQLTemplate
	Table             string
	HNSWIndexName     string
	MetadataIndexName string
}

func (r *sqlVectorCollectionCreateTableRequest) Validate() error {
	if r.Table == "" || r.HNSWIndexName == "" || r.MetadataIndexName == "" {
		return fmt.Errorf("missing required fields")
	}
	return nil
}

// -- Upsert request --

type sqlVectorCollectionUpsertRequest struct {
	sqltemplate.SQLTemplate
	Table     string
	Vector    *Vector
	Embedding any // pgvector.HalfVector
}

func (r *sqlVectorCollectionUpsertRequest) Validate() error {
	if r.Table == "" {
		return fmt.Errorf("missing table")
	}
	if r.Vector == nil {
		return fmt.Errorf("missing vector")
	}
	return nil
}

// -- Delete request (whole resource) --

type sqlVectorCollectionDeleteRequest struct {
	sqltemplate.SQLTemplate
	Table string
	Name  string
}

func (r *sqlVectorCollectionDeleteRequest) Validate() error {
	if r.Table == "" || r.Name == "" {
		return fmt.Errorf("missing required fields")
	}
	return nil
}

// -- DeleteSubresources request (targeted cleanup) --

type sqlVectorCollectionDeleteSubresourcesRequest struct {
	sqltemplate.SQLTemplate
	Table        string
	Name         string
	Subresources []string
}

func (r *sqlVectorCollectionDeleteSubresourcesRequest) Validate() error {
	if r.Table == "" || r.Name == "" {
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

// -- GetContent request --

type sqlVectorCollectionGetContentResponse struct {
	Subresource string
	Content     string
}

type sqlVectorCollectionGetContentRequest struct {
	sqltemplate.SQLTemplate
	Table    string
	Name     string
	Response *sqlVectorCollectionGetContentResponse
}

func (r *sqlVectorCollectionGetContentRequest) Validate() error {
	if r.Table == "" || r.Name == "" {
		return fmt.Errorf("missing required fields")
	}
	return nil
}

func (r *sqlVectorCollectionGetContentRequest) Results() (*sqlVectorCollectionGetContentResponse, error) {
	cp := *r.Response
	return &cp, nil
}

// -- Search request --

type sqlVectorCollectionSearchResponse struct {
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

type sqlVectorCollectionSearchRequest struct {
	sqltemplate.SQLTemplate
	Table          string
	QueryEmbedding any // pgvector.HalfVector
	Limit          int64
	Response       *sqlVectorCollectionSearchResponse

	// Filters (nil means no filter)
	NameValues      []string
	FolderValues    []string
	MetadataFilters []MetadataFilterEntry
}

func (r *sqlVectorCollectionSearchRequest) Validate() error {
	if r.Table == "" {
		return fmt.Errorf("missing table")
	}
	if r.Limit <= 0 {
		return fmt.Errorf("limit must be positive")
	}
	return nil
}

func (r *sqlVectorCollectionSearchRequest) Results() (*sqlVectorCollectionSearchResponse, error) {
	// Set-returning query: return a copy because Response is reused for each
	// Scan call. Scan allocates a fresh []byte for Metadata, so a shallow copy
	// is safe.
	cp := *r.Response
	return &cp, nil
}

func (r *sqlVectorCollectionSearchRequest) NameFilter() bool {
	return len(r.NameValues) > 0
}

func (r *sqlVectorCollectionSearchRequest) NameFilterSlice() reflect.Value {
	return reflect.ValueOf(r.NameValues)
}

func (r *sqlVectorCollectionSearchRequest) FolderFilter() bool {
	return len(r.FolderValues) > 0
}

func (r *sqlVectorCollectionSearchRequest) FolderFilterSlice() reflect.Value {
	return reflect.ValueOf(r.FolderValues)
}
