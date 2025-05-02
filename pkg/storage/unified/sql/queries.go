package sql

import (
	"database/sql"
	"embed"
	"fmt"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Templates setup.
var (
	//go:embed data/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `data/*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// Templates.
var (
	sqlResourceDelete              = mustTemplate("resource_delete.sql")
	sqlResourceInsert              = mustTemplate("resource_insert.sql")
	sqlResourceUpdate              = mustTemplate("resource_update.sql")
	sqlResourceRead                = mustTemplate("resource_read.sql")
	sqlResourceStats               = mustTemplate("resource_stats.sql")
	sqlResourceList                = mustTemplate("resource_list.sql")
	sqlResourceHistoryList         = mustTemplate("resource_history_list.sql")
	sqlResourceUpdateRV            = mustTemplate("resource_update_rv.sql")
	sqlResourceHistoryRead         = mustTemplate("resource_history_read.sql")
	sqlResourceHistoryReadLatestRV = mustTemplate("resource_history_read_latest_rv.sql")
	sqlResourceHistoryUpdateRV     = mustTemplate("resource_history_update_rv.sql")
	sqlResourceHistoryInsert       = mustTemplate("resource_history_insert.sql")
	sqlResourceHistoryPoll         = mustTemplate("resource_history_poll.sql")
	sqlResourceHistoryGet          = mustTemplate("resource_history_get.sql")
	sqlResourceHistoryDelete       = mustTemplate("resource_history_delete.sql")
	sqlResourceHistoryPrune        = mustTemplate("resource_history_prune.sql")
	sqlResourceInsertFromHistory   = mustTemplate("resource_insert_from_history.sql")

	// sqlResourceLabelsInsert = mustTemplate("resource_labels_insert.sql")
	sqlResourceVersionGet    = mustTemplate("resource_version_get.sql")
	sqlResourceVersionUpdate = mustTemplate("resource_version_update.sql")
	sqlResourceVersionInsert = mustTemplate("resource_version_insert.sql")
	sqlResourceVersionList   = mustTemplate("resource_version_list.sql")

	sqlResourceBlobInsert = mustTemplate("resource_blob_insert.sql")
	sqlResourceBlobQuery  = mustTemplate("resource_blob_query.sql")
)

// TxOptions.
var (
	ReadCommitted = &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
	}
	ReadCommittedRO = &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
		ReadOnly:  true,
	}
	RepeatableRead = &sql.TxOptions{
		Isolation: sql.LevelRepeatableRead,
	}
)

type sqlResourceRequest struct {
	sqltemplate.SQLTemplate
	GUID       string
	WriteEvent resource.WriteEvent
	Generation int64
	Folder     string

	// Useful when batch writing
	ResourceVersion int64
}

func (r sqlResourceRequest) Validate() error {
	return nil // TODO
}

type sqlResourceInsertFromHistoryRequest struct {
	sqltemplate.SQLTemplate
	Key *resource.ResourceKey
}

func (r sqlResourceInsertFromHistoryRequest) Validate() error {
	if r.Key == nil {
		return fmt.Errorf("missing key")
	}
	return nil
}

type sqlStatsRequest struct {
	sqltemplate.SQLTemplate
	Namespace string
	Group     string
	Resource  string
	Folder    string
	MinCount  int
}

func (r sqlStatsRequest) Validate() error {
	if r.Folder != "" && r.Namespace == "" {
		return fmt.Errorf("folder constraint requires a namespace")
	}
	return nil
}

type historyPollResponse struct {
	Key             resource.ResourceKey
	GUID            string
	ResourceVersion int64
	PreviousRV      *int64
	Value           []byte
	Action          int
	Folder          string
}

func (r *historyPollResponse) Results() (*historyPollResponse, error) {
	return r, nil
}

type groupResourceRV map[string]map[string]int64

type sqlResourceHistoryPollRequest struct {
	sqltemplate.SQLTemplate
	Resource             string
	Group                string
	SinceResourceVersion int64
	Response             *historyPollResponse
}

func (r *sqlResourceHistoryPollRequest) Validate() error {
	return nil // TODO
}

func (r *sqlResourceHistoryPollRequest) Results() (*historyPollResponse, error) {
	prevRV := r.Response.PreviousRV
	if prevRV == nil {
		prevRV = new(int64)
	}
	return &historyPollResponse{
		Key: resource.ResourceKey{
			Namespace: r.Response.Key.Namespace,
			Group:     r.Response.Key.Group,
			Resource:  r.Response.Key.Resource,
			Name:      r.Response.Key.Name,
		},
		Folder:          r.Response.Folder,
		ResourceVersion: r.Response.ResourceVersion,
		PreviousRV:      prevRV,
		Value:           r.Response.Value,
		Action:          r.Response.Action,
	}, nil
}

// sqlResourceReadRequest can be used to retrieve a row fromthe "resource" tables.
func NewReadResponse() *resource.BackendReadResponse {
	return &resource.BackendReadResponse{
		Key: &resource.ResourceKey{},
	}
}

type sqlResourceReadRequest struct {
	sqltemplate.SQLTemplate
	Request  *resource.ReadRequest
	Response *resource.BackendReadResponse
}

func (r *sqlResourceReadRequest) Validate() error {
	return nil // TODO
}

func (r *sqlResourceReadRequest) Results() (*resource.BackendReadResponse, error) {
	return r.Response, nil
}

// List
type sqlResourceListRequest struct {
	sqltemplate.SQLTemplate
	Request *resource.ListRequest
}

func (r sqlResourceListRequest) Validate() error {
	return nil // TODO
}

type historyReadRequest struct {
	Key             *resource.ResourceKey
	ResourceVersion int64
}

type sqlResourceHistoryReadRequest struct {
	sqltemplate.SQLTemplate
	Request  *historyReadRequest
	Response *resource.BackendReadResponse
}

func (r sqlResourceHistoryReadRequest) Validate() error {
	return nil // TODO
}

func (r sqlResourceHistoryReadRequest) Results() (*resource.BackendReadResponse, error) {
	return r.Response, nil
}

type historyReadLatestRVRequest struct {
	Key       *resource.ResourceKey
	EventType resource.WatchEvent_Type
}

type sqlResourceHistoryReadLatestRVRequest struct {
	sqltemplate.SQLTemplate
	Request  *historyReadLatestRVRequest
	Response *resourceHistoryReadLatestRVResponse
}

func (r sqlResourceHistoryReadLatestRVRequest) Validate() error {
	return nil // TODO
}

func (r sqlResourceHistoryReadLatestRVRequest) Results() (*resourceHistoryReadLatestRVResponse, error) {
	return r.Response, nil
}

type resourceHistoryReadLatestRVResponse struct {
	ResourceVersion int64
}

func (r *resourceHistoryReadLatestRVResponse) Results() (*resourceHistoryReadLatestRVResponse, error) {
	return r, nil
}

type historyListRequest struct {
	ResourceVersion, Limit, Offset int64
	Folder                         string
	Options                        *resource.ListOptions
}
type sqlResourceHistoryListRequest struct {
	sqltemplate.SQLTemplate
	Request  *historyListRequest
	Response *resource.ResourceWrapper
}

func (r sqlResourceHistoryListRequest) Validate() error {
	return nil // TODO
}

func (r sqlResourceHistoryListRequest) Results() (*resource.ResourceWrapper, error) {
	// sqlResourceHistoryListRequest is a set-returning query. As such, it
	// should not return its *Response, since that will be overwritten in the
	// next call to `Scan`, so it needs to return a copy of it. Note, though,
	// that it is safe to return the same `Response.Value` since `Scan`
	// allocates a new slice of bytes each time.
	return &resource.ResourceWrapper{
		ResourceVersion: r.Response.ResourceVersion,
		Value:           r.Response.Value,
	}, nil
}

type sqlResourceHistoryDeleteRequest struct {
	sqltemplate.SQLTemplate
	GUID string

	Namespace string
	Group     string
	Resource  string
}

func (r *sqlResourceHistoryDeleteRequest) Validate() error {
	if r.Namespace == "" {
		return fmt.Errorf("missing namespace")
	}
	if r.GUID == "" {
		if r.Group == "" {
			return fmt.Errorf("missing group")
		}
		if r.Resource == "" {
			return fmt.Errorf("missing resource")
		}
	}
	return nil
}

type sqlGetHistoryRequest struct {
	sqltemplate.SQLTemplate
	Key           *resource.ResourceKey
	Trash         bool  // only deleted items
	StartRV       int64 // from NextPageToken
	MinRV         int64 // minimum resource version for NotOlderThan
	ExactRV       int64 // exact resource version for Exact
	SortAscending bool  // if true, sort by resource_version ASC, otherwise DESC
}

func (r sqlGetHistoryRequest) Validate() error {
	return nil // TODO
}

// prune resource history
type sqlPruneHistoryRequest struct {
	sqltemplate.SQLTemplate
	Key                   *resource.ResourceKey
	PartitionByGeneration bool // include generation in the partition
	HistoryLimit          int64
}

func (r *sqlPruneHistoryRequest) Validate() error {
	if r.HistoryLimit <= 0 {
		return fmt.Errorf("history limit must be greater than zero")
	}
	if r.Key == nil {
		return fmt.Errorf("missing key")
	}
	if r.Key.Namespace == "" {
		return fmt.Errorf("missing namespace")
	}
	if r.Key.Group == "" {
		return fmt.Errorf("missing group")
	}
	if r.Key.Resource == "" {
		return fmt.Errorf("missing resource")
	}
	return nil
}

type sqlResourceBlobInsertRequest struct {
	sqltemplate.SQLTemplate
	Now         time.Time
	Info        *utils.BlobInfo
	Key         *resource.ResourceKey
	Value       []byte
	ContentType string
}

func (r sqlResourceBlobInsertRequest) Validate() error {
	if len(r.Value) < 1 {
		return fmt.Errorf("missing body")
	}
	return nil
}

type sqlResourceBlobQueryRequest struct {
	sqltemplate.SQLTemplate
	Key *resource.ResourceKey
	UID string
}

func (r sqlResourceBlobQueryRequest) Validate() error {
	return nil
}

// update RV

type sqlResourceUpdateRVRequest struct {
	sqltemplate.SQLTemplate
	GUIDToRV map[string]int64
}

func (r sqlResourceUpdateRVRequest) Validate() error {
	return nil // TODO
}

// resource_version table requests.
type resourceVersionResponse struct {
	ResourceVersion int64
	CurrentEpoch    int64
}

func (r *resourceVersionResponse) Results() (*resourceVersionResponse, error) {
	return r, nil
}

type groupResourceVersion struct {
	Group, Resource string
	ResourceVersion int64
}

type sqlResourceVersionUpsertRequest struct {
	sqltemplate.SQLTemplate
	Group, Resource string
	ResourceVersion int64
}

func (r sqlResourceVersionUpsertRequest) Validate() error {
	return nil // TODO
}

type sqlResourceVersionGetRequest struct {
	sqltemplate.SQLTemplate
	Group, Resource string
	ReadOnly        bool
	Response        *resourceVersionResponse
}

func (r sqlResourceVersionGetRequest) Validate() error {
	return nil // TODO
}
func (r sqlResourceVersionGetRequest) Results() (*resourceVersionResponse, error) {
	return &resourceVersionResponse{
		ResourceVersion: r.Response.ResourceVersion,
		CurrentEpoch:    r.Response.CurrentEpoch,
	}, nil
}

type sqlResourceVersionListRequest struct {
	sqltemplate.SQLTemplate
	*groupResourceVersion
}

func (r *sqlResourceVersionListRequest) Validate() error {
	return nil // TODO
}

func (r *sqlResourceVersionListRequest) Results() (*groupResourceVersion, error) {
	x := *r.groupResourceVersion
	return &x, nil
}
