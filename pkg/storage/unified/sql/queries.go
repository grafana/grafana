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
	sqlResourceUpdateRV        = mustTemplate("resource_update_rv.sql")
	sqlResourceHistoryRead     = mustTemplate("resource_history_read.sql")
	sqlResourceHistoryUpdateRV = mustTemplate("resource_history_update_rv.sql")
	sqlResourceHistoryInsert   = mustTemplate("resource_history_insert.sql")
	sqlResourceHistoryPoll     = mustTemplate("resource_history_poll.sql")

	// sqlResourceLabelsInsert = mustTemplate("resource_labels_insert.sql")
	sqlResourceVersionGet    = mustTemplate("resource_version_get.sql")
	sqlResourceVersionInc    = mustTemplate("resource_version_inc.sql")
	sqlResourceVersionInsert = mustTemplate("resource_version_insert.sql")
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

// SQLError is an error returned by the database, which includes additionally
// debugging information about what was sent to the database.
type SQLError struct {
	Err          error
	CallType     string // either Query, QueryRow or Exec
	TemplateName string
	Query        string
	RawQuery     string
	ScanDest     []any

	// potentially regulated information is not exported and only directly
	// available for local testing and local debugging purposes, making sure it
	// is never marshaled to JSON or any other serialization.

	arguments []any
}

func (e SQLError) Unwrap() error {
	return e.Err
}

func (e SQLError) Error() string {
	return fmt.Sprintf("%s: %s with %d input arguments and %d output "+
		"destination arguments: %v", e.TemplateName, e.CallType,
		len(e.arguments), len(e.ScanDest), e.Err)
}

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

type sqlResourceHistoryPollRequest struct {
	*sqltemplate.SQLTemplate
	SinceResourceVersion int64
	*historyPollResponse
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

func (r *resourceVersion) Results() (*resourceVersion, error) {
	return r, nil
}

type sqlResourceVersionRequest struct {
	*sqltemplate.SQLTemplate
	Key *resource.ResourceKey
	*resourceVersion
}

func (r sqlResourceVersionRequest) Validate() error {
	return nil // TODO
}
