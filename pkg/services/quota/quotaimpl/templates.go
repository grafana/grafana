package quotaimpl

import (
	"embed"
	"fmt"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

//go:embed queries/*.sql
var sqlTemplatesFS embed.FS

var sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, "queries/*.sql"))

func mustTemplate(filename string) *template.Template {
	if tmpl := sqlTemplates.Lookup(filename); tmpl != nil {
		return tmpl
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

var (
	deleteByUserTemplate   = mustTemplate("delete_by_user.sql")
	findQuotaTemplate      = mustTemplate("find_quota.sql")
	insertQuotaTemplate    = mustTemplate("insert_quota.sql")
	updateQuotaTemplate    = mustTemplate("update_quota.sql")
	userScopeQuotaTemplate = mustTemplate("user_scope_quota.sql")
	orgScopeQuotaTemplate  = mustTemplate("org_scope_quota.sql")
)

type deleteByUserQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable string
	UserID     int64
}

func (q deleteByUserQuery) Validate() error { return nil }

type findQuotaQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable string
	Cmd        *quota.UpdateQuotaCmd
}

func (q findQuotaQuery) Validate() error { return nil }

type insertQuotaQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable  string
	LimitColumn string
	Cmd         *quota.UpdateQuotaCmd
	Created     time.Time
	Updated     time.Time
}

func (q insertQuotaQuery) Validate() error { return nil }

type updateQuotaQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable  string
	LimitColumn string
	QuotaID     int64
	Limit       int64
	Updated     time.Time
}

func (q updateQuotaQuery) Validate() error { return nil }

type userScopeQuotaQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable  string
	LimitColumn string
	UserID      int64
	OrgID       int64
}

func (q userScopeQuotaQuery) Validate() error { return nil }

type orgScopeQuotaQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable  string
	LimitColumn string
	UserID      int64
	OrgID       int64
}

func (q orgScopeQuotaQuery) Validate() error { return nil }
