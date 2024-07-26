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
	sqlResourceDelete          = mustTemplate("resource_delete.sql")
	sqlResourceInsert          = mustTemplate("resource_insert.sql")
	sqlResourceUpdate          = mustTemplate("resource_update.sql")
	sqlResourceRead            = mustTemplate("resource_read.sql")
	sqlResourceList            = mustTemplate("resource_list.sql")
	sqlResourceHistoryList     = mustTemplate("resource_history_list.sql")
	sqlResourceUpdateRV        = mustTemplate("resource_update_rv.sql")
	sqlResourceHistoryRead     = mustTemplate("resource_history_read.sql")
	sqlResourceHistoryUpdateRV = mustTemplate("resource_history_update_rv.sql")
	sqlResourceHistoryInsert   = mustTemplate("resource_history_insert.sql")
	sqlResourceHistoryPoll     = mustTemplate("resource_history_poll.sql")

	// sqlResourceLabelsInsert = mustTemplate("resource_labels_insert.sql")
	sqlResourceVersionGet    = mustTemplate("resource_version_get.sql")
	sqlResourceVersionInc    = mustTemplate("resource_version_inc.sql")
	sqlResourceVersionInsert = mustTemplate("resource_version_insert.sql")
	sqlResourceVersionList   = mustTemplate("resource_version_list.sql")
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
)

type sqlResourceRequest struct {
	*sqltemplate.SQLTemplate
	GUID       string
	WriteEvent resource.WriteEvent
}

func (r sqlResourceRequest) Validate() error {
	return nil // TODO
}

type historyPollResponse struct {
	Key             resource.ResourceKey
	ResourceVersion int64
	Value           []byte
	Action          int
}

func (r *historyPollResponse) Results() (*historyPollResponse, error) {
	return r, nil
}

type groupResourceRV map[string]map[string]int64
type sqlResourceHistoryPollRequest struct {
	*sqltemplate.SQLTemplate
	Resource             string
	Group                string
	SinceResourceVersion int64
	Response             *historyPollResponse
}

func (r sqlResourceHistoryPollRequest) Validate() error {
	return nil // TODO
}

// sqlResourceReadRequest can be used to retrieve a row fromthe "resource" tables.

type readResponse struct {
	resource.ReadResponse
}

func (r *readResponse) Results() (*readResponse, error) {
	return r, nil
}

type sqlResourceReadRequest struct {
	*sqltemplate.SQLTemplate
	Request *resource.ReadRequest
	*readResponse
}

func (r sqlResourceReadRequest) Validate() error {
	return nil // TODO
}

// List
type sqlResourceListRequest struct {
	*sqltemplate.SQLTemplate
	Request  *resource.ListRequest
	Response *resource.ResourceWrapper
}

func (r sqlResourceListRequest) Validate() error {
	return nil // TODO
}

func (r sqlResourceListRequest) Results() (*resource.ResourceWrapper, error) {
	// sqlResourceListRequest is a set-returning query. As such, it
	// should not return its *Response, since that will be overwritten in the
	// next call to `Scan`, so it needs to return a copy of it. Note, though,
	// that it is safe to return the same `Response.Value` since `Scan`
	// allocates a new slice of bytes each time.
	return &resource.ResourceWrapper{
		ResourceVersion: r.Response.ResourceVersion,
		Value:           r.Response.Value,
	}, nil
}

type historyListRequest struct {
	ResourceVersion, Limit, Offset int64
	Options                        *resource.ListOptions
}
type sqlResourceHistoryListRequest struct {
	*sqltemplate.SQLTemplate
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

// update RV

type sqlResourceUpdateRVRequest struct {
	*sqltemplate.SQLTemplate
	GUID            string
	ResourceVersion int64
}

func (r sqlResourceUpdateRVRequest) Validate() error {
	return nil // TODO
}

// resource_version table requests.
type resourceVersion struct {
	ResourceVersion int64
}

type groupResourceVersion struct {
	Group, Resource string
	ResourceVersion int64
}

func (r *resourceVersion) Results() (*resourceVersion, error) {
	return r, nil
}

type sqlResourceVersionRequest struct {
	*sqltemplate.SQLTemplate
	Group, Resource string
	*resourceVersion
}

func (r sqlResourceVersionRequest) Validate() error {
	return nil // TODO
}

type sqlResourceVersionListRequest struct {
	*sqltemplate.SQLTemplate
	*groupResourceVersion
}

func (r sqlResourceVersionListRequest) Validate() error {
	return nil // TODO
}
