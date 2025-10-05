package legacy

import (
	"database/sql"
	"embed"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Templates setup.
var (
	//go:embed *.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// Templates.
var (
	sqlQuery = mustTemplate("sql_query.sql")
)

// SELECT c.uid,c.org_id,c.{{ .Ident "type" }},c.config,c.description,c.label,c.provisioned,
//
//	src.{{ .Ident "type" }} as src_type, src.uid as src_uid,
//	tgt.{{ .Ident "type" }} as tgt_type, tgt.uid as tgt_uid
type correlationsResponse struct {
	UID         string
	OrgID       int64
	Type        string
	Config      string
	Description string
	Label       string
	provisioned bool
	SourceType  sql.NullString
	SourceUID   sql.NullString
	TargetType  sql.NullString
	TargetUID   sql.NullString
}

type correlationsQuery struct {
	sqltemplate.SQLTemplate

	OrgID          int64
	CorrelationUID string
	SourceUIDs     []string

	CorrelationTable string
	DataSourceTable  string

	Response *correlationsResponse
}

func (r correlationsQuery) Validate() error {
	if r.OrgID == 0 {
		return fmt.Errorf("requires orgId")
	}
	return nil
}

func newCorrelationsQueryReq(sql *legacysql.LegacyDatabaseHelper, orgId int64) correlationsQuery {
	return correlationsQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),

		OrgID: orgId,

		CorrelationTable: sql.Table("correlation"),
		DataSourceTable:  sql.Table("data_source"),
	}
}
