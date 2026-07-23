package vector

import (
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"reflect"
	"text/template"
	"time"

	pgvector "github.com/pgvector/pgvector-go"

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
	sqlVectorCollectionExists            = mustTemplate("vector_collection_exists.sql")
	sqlVectorCollectionSearch            = mustTemplate("vector_collection_search.sql")
	sqlVectorBackfillJobsList            = mustTemplate("vector_backfill_jobs_list.sql")
	sqlVectorBackfillJobsCreate          = mustTemplate("vector_backfill_jobs_create.sql")
	sqlVectorBackfillJobsUpdate          = mustTemplate("vector_backfill_jobs_update.sql")
	sqlVectorBackfillJobsSetError        = mustTemplate("vector_backfill_jobs_set_error.sql")
	sqlVectorBackfillJobsComplete        = mustTemplate("vector_backfill_jobs_complete.sql")
	sqlQueryCacheGet                     = mustTemplate("query_cache_get.sql")
	sqlQueryCacheCount                   = mustTemplate("query_cache_count.sql")
	sqlQueryCacheEvictOldest             = mustTemplate("query_cache_evict_oldest.sql")
	sqlQueryCacheInsert                  = mustTemplate("query_cache_insert.sql")
	sqlRateBucketIncrement               = mustTemplate("rate_bucket_increment.sql")
	sqlRateBucketSweep                   = mustTemplate("rate_bucket_sweep.sql")
	sqlVectorCatalogList                 = mustTemplate("vector_catalog_list.sql")
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

type sqlVectorCollectionExistsResponse struct {
	Exists int
}

type sqlVectorCollectionExistsRequest struct {
	sqltemplate.SQLTemplate
	Resource  string
	Namespace string
	Model     string
	UID       string
	Response  *sqlVectorCollectionExistsResponse
}

func (r *sqlVectorCollectionExistsRequest) Validate() error {
	if r.Resource == "" || r.Namespace == "" || r.Model == "" || r.UID == "" {
		return fmt.Errorf("missing required fields")
	}
	return nil
}

func (r *sqlVectorCollectionExistsRequest) Results() (*sqlVectorCollectionExistsResponse, error) {
	cp := *r.Response
	return &cp, nil
}

type sqlVectorBackfillJobsListResponse struct {
	ID          int64
	Model       string
	Resource    string
	StoppingRV  int64
	LastSeenKey sql.NullString
	IsComplete  bool
	LastError   sql.NullString
}

type sqlVectorBackfillJobsListRequest struct {
	sqltemplate.SQLTemplate
	Model    string
	Response *sqlVectorBackfillJobsListResponse
}

func (r *sqlVectorBackfillJobsListRequest) Validate() error {
	if r.Model == "" {
		return fmt.Errorf("missing model")
	}
	return nil
}

func (r *sqlVectorBackfillJobsListRequest) Results() (*sqlVectorBackfillJobsListResponse, error) {
	cp := *r.Response
	return &cp, nil
}

type sqlVectorCatalogListRequest struct {
	sqltemplate.SQLTemplate
	Response *sqlVectorCatalogListResponse
}

func (r *sqlVectorCatalogListRequest) Validate() error { return nil }

func (r *sqlVectorCatalogListRequest) Results() (*sqlVectorCatalogListResponse, error) {
	cp := *r.Response
	return &cp, nil
}

type sqlVectorCatalogListResponse struct {
	GroupName    string
	Resource     string
	PartitionKey string
	IsExternal   bool
}

type sqlVectorBackfillJobsCreateRequest struct {
	sqltemplate.SQLTemplate
	Model      string
	Resource   string
	StoppingRV int64
}

func (r *sqlVectorBackfillJobsCreateRequest) Validate() error {
	if r.Model == "" {
		return fmt.Errorf("missing model")
	}
	if r.Resource == "" {
		return fmt.Errorf("missing resource")
	}
	if r.StoppingRV <= 0 {
		return fmt.Errorf("stopping_rv must be positive")
	}
	return nil
}

type sqlVectorBackfillJobsUpdateRequest struct {
	sqltemplate.SQLTemplate
	ID          int64
	LastSeenKey sql.NullString
	LastError   sql.NullString
}

func (r *sqlVectorBackfillJobsUpdateRequest) Validate() error {
	if r.ID == 0 {
		return fmt.Errorf("missing id")
	}
	return nil
}

type sqlVectorBackfillJobsSetErrorRequest struct {
	sqltemplate.SQLTemplate
	ID        int64
	LastError sql.NullString
}

func (r *sqlVectorBackfillJobsSetErrorRequest) Validate() error {
	if r.ID == 0 {
		return fmt.Errorf("missing id")
	}
	return nil
}

type sqlVectorBackfillJobsCompleteRequest struct {
	sqltemplate.SQLTemplate
	ID int64
}

func (r *sqlVectorBackfillJobsCompleteRequest) Validate() error {
	if r.ID == 0 {
		return fmt.Errorf("missing id")
	}
	return nil
}

type sqlVectorCollectionGetContentResponse struct {
	Subresource string
	Content     string
	Folder      string
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

type sqlQueryCacheGetResponse struct {
	Embedding pgvector.HalfVector
}

type sqlQueryCacheGetRequest struct {
	sqltemplate.SQLTemplate
	Namespace string
	Model     string
	QueryHash string
	Response  *sqlQueryCacheGetResponse
}

func (r *sqlQueryCacheGetRequest) Validate() error {
	if r.Namespace == "" || r.Model == "" || r.QueryHash == "" {
		return fmt.Errorf("missing required fields")
	}
	return nil
}

func (r *sqlQueryCacheGetRequest) Results() (*sqlQueryCacheGetResponse, error) {
	cp := *r.Response
	return &cp, nil
}

type sqlQueryCacheCountResponse struct {
	Count int64
}

type sqlQueryCacheCountRequest struct {
	sqltemplate.SQLTemplate
	Namespace string
	Response  *sqlQueryCacheCountResponse
}

func (r *sqlQueryCacheCountRequest) Validate() error {
	if r.Namespace == "" {
		return fmt.Errorf("missing namespace")
	}
	return nil
}

func (r *sqlQueryCacheCountRequest) Results() (*sqlQueryCacheCountResponse, error) {
	cp := *r.Response
	return &cp, nil
}

type sqlQueryCacheEvictOldestRequest struct {
	sqltemplate.SQLTemplate
	Namespace string
	Limit     int64
}

func (r *sqlQueryCacheEvictOldestRequest) Validate() error {
	if r.Namespace == "" {
		return fmt.Errorf("missing namespace")
	}
	if r.Limit <= 0 {
		return fmt.Errorf("limit must be positive")
	}
	return nil
}

type sqlQueryCacheInsertRequest struct {
	sqltemplate.SQLTemplate
	Namespace string
	Model     string
	QueryHash string
	Embedding any // pgvector.HalfVector
}

func (r *sqlQueryCacheInsertRequest) Validate() error {
	if r.Namespace == "" || r.Model == "" || r.QueryHash == "" {
		return fmt.Errorf("missing required fields")
	}
	if r.Embedding == nil {
		return fmt.Errorf("missing embedding")
	}
	return nil
}

type sqlRateBucketIncrementResponse struct {
	Count int64
}

type sqlRateBucketIncrementRequest struct {
	sqltemplate.SQLTemplate
	Namespace   string
	WindowStart time.Time
	Response    *sqlRateBucketIncrementResponse
}

func (r *sqlRateBucketIncrementRequest) Validate() error {
	if r.Namespace == "" {
		return fmt.Errorf("missing namespace")
	}
	if r.WindowStart.IsZero() {
		return fmt.Errorf("missing window_start")
	}
	return nil
}

func (r *sqlRateBucketIncrementRequest) Results() (*sqlRateBucketIncrementResponse, error) {
	cp := *r.Response
	return &cp, nil
}

type sqlRateBucketSweepRequest struct {
	sqltemplate.SQLTemplate
	Cutoff time.Time
}

func (r *sqlRateBucketSweepRequest) Validate() error {
	if r.Cutoff.IsZero() {
		return fmt.Errorf("missing cutoff")
	}
	return nil
}
