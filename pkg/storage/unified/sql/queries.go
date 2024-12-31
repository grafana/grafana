package sql

import (
	"database/sql"
	"embed"
	"fmt"
	"text/template"

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
	sqlResourceDelete = mustTemplate("resource_delete.sql")
	sqlResourceInsert = mustTemplate("resource_insert.sql")
	sqlResourceUpdate = mustTemplate("resource_update.sql")
	sqlResourceRead   = mustTemplate("resource_read.sql")
	sqlResourceStats  = mustTemplate("resource_stats.sql")
	sqlResourceList   = mustTemplate("resource_list.sql")
	// sqlResourceMaxRV             = mustTemplate("resource_max_rv.sql")
	sqlResourceHistoryList       = mustTemplate("resource_history_list.sql")
	sqlResourceUpdateRV          = mustTemplate("resource_update_rv.sql")
	sqlResourceHistoryRead       = mustTemplate("resource_history_read.sql")
	sqlResourceHistoryUpdateRV   = mustTemplate("resource_history_update_rv.sql")
	sqlResoureceHistoryUpdateUid = mustTemplate("resource_history_update_uid.sql")
	sqlResourceHistoryInsert     = mustTemplate("resource_history_insert.sql")
	sqlResourceHistoryPoll       = mustTemplate("resource_history_poll.sql")

	// sqlResourceLabelsInsert = mustTemplate("resource_labels_insert.sql")
	sqlResourceVersionGet    = mustTemplate("resource_version_get.sql")
	sqlResourceVersionUpdate = mustTemplate("resource_version_update.sql")
	sqlResourceVersionInsert = mustTemplate("resource_version_insert.sql")
	sqlResourceVersionList   = mustTemplate("resource_version_list.sql")

	sqlResourceLockInsert = mustTemplate("resource_lock_insert.sql")
	sqlResourceLockDelete = mustTemplate("resource_lock_delete.sql")
	sqlResourceLockGet    = mustTemplate("resource_lock_get.sql")
	// sqlResourceLockUpdate = mustTemplate("resource_lock_update_rv.sql")
	sqlResourceLockMinRV = mustTemplate("resource_lock_min_rv.sql")
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
	Folder     string
}

func (r sqlResourceRequest) Validate() error {
	return nil // TODO
}

type sqlStatsRequest struct {
	sqltemplate.SQLTemplate
	Namespace string
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

// update resource history

type sqlResourceHistoryUpdateRequest struct {
	sqltemplate.SQLTemplate
	WriteEvent resource.WriteEvent
	OldUID     string
	NewUID     string
}

func (r sqlResourceHistoryUpdateRequest) Validate() error {
	return nil // TODO
}

// update RV

type sqlResourceUpdateRVRequest struct {
	sqltemplate.SQLTemplate
	GUID            string
	ResourceVersion int64
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

type sqlResourceLockInsertRequest struct {
	sqltemplate.SQLTemplate
	Key *resource.ResourceKey
}

func (r sqlResourceLockInsertRequest) Validate() error {
	if r.Key == nil || r.Key.Group == "" || r.Key.Resource == "" || r.Key.Namespace == "" || r.Key.Name == "" {
		return fmt.Errorf("all the fields in the key must be set")
	}
	return nil
}

type sqlResourceLockGetRequest struct {
	sqltemplate.SQLTemplate
	Key      *resource.ResourceKey
	Response *resourceVersionResponse
}

func (r sqlResourceLockGetRequest) Validate() error {
	if r.Key == nil || r.Key.Group == "" || r.Key.Resource == "" || r.Key.Namespace == "" || r.Key.Name == "" {
		return fmt.Errorf("all the fields in the key must be set")
	}
	return nil
}
func (r sqlResourceLockGetRequest) Results() (int64, error) {
	return r.Response.ResourceVersion, nil
}

type sqlResourceLockMinRVRequest struct {
	sqltemplate.SQLTemplate
	Key      *resource.ResourceKey
	Response *resourceVersionResponse
}

func (r sqlResourceLockMinRVRequest) Validate() error {
	if r.Key == nil || r.Key.Group == "" || r.Key.Resource == "" {
		return fmt.Errorf("group and resource must be set")
	}
	return nil
}
func (r sqlResourceLockMinRVRequest) Results() (int64, error) {
	if r.Response == nil {
		return 0, fmt.Errorf("response not set")
	}
	return r.Response.ResourceVersion, nil
}
