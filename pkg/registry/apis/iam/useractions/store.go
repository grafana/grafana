package useractions

import (
	"context"
	"text/template"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// actionsQuery selects the distinct actions of every role granting permissions
// to an identity: its basic role (and Grafana Admin when it is a server admin),
// roles assigned to the user, and roles assigned to its teams.
const actionsQuery = `
SELECT DISTINCT p.action FROM {{ .Ident .PermissionTable }} as p
INNER JOIN (
  SELECT role_id FROM {{ .Ident .BuiltinRoleTable }} as br WHERE (br.role = {{ .Arg .Query.Role }} AND (br.org_id = {{ .Arg .Query.OrgID }} OR br.org_id = 0))
    {{ if .Query.IsServerAdmin }}
    OR (br.role = 'Grafana Admin')
    {{ end }}
    {{ if .Query.UserID }}
  UNION ALL
  SELECT role_id FROM {{ .Ident .UserRoleTable }} as ur WHERE ur.user_id = {{ .Arg .Query.UserID }} AND (ur.org_id = {{ .Arg .Query.OrgID }} OR ur.org_id = 0)
    {{ end }}
    {{ if .Query.TeamIDs }}
  UNION ALL
  SELECT role_id FROM {{ .Ident .TeamRoleTable }} as tr WHERE tr.team_id IN ({{ .ArgList .Query.TeamIDs }}) AND tr.org_id = {{ .Arg .Query.OrgID }}
  {{ end }}
) as roles ON p.role_id = roles.role_id
`

var sqlQueryActions = template.Must(template.New("actions_query.sql").Parse(actionsQuery))

// ActionsQuery identifies whose actions to look up.
type ActionsQuery struct {
	OrgID         int64
	UserID        int64
	TeamIDs       []int64
	Role          string
	IsServerAdmin bool
}

type getActionsQuery struct {
	sqltemplate.SQLTemplate
	Query *ActionsQuery

	PermissionTable  string
	UserRoleTable    string
	TeamRoleTable    string
	BuiltinRoleTable string
}

func (r getActionsQuery) Validate() error {
	return nil
}

func newGetActions(sql *legacysql.LegacyDatabaseHelper, q *ActionsQuery) getActionsQuery {
	return getActionsQuery{
		SQLTemplate:      sqltemplate.New(sql.DialectForDriver()),
		Query:            q,
		PermissionTable:  sql.Table("permission"),
		UserRoleTable:    sql.Table("user_role"),
		TeamRoleTable:    sql.Table("team_role"),
		BuiltinRoleTable: sql.Table("builtin_role"),
	}
}

// ActionStore lists the distinct RBAC actions granted to an identity.
type ActionStore interface {
	GetUserActions(ctx context.Context, ns claims.NamespaceInfo, query ActionsQuery) ([]string, error)
}

// SQLActionStore reads actions from the RBAC tables. It goes through legacysql
// so the same implementation serves single-tenant Grafana and the multi-tenant
// IAM apiserver, where the tables live in a per-tenant schema resolved from the
// request namespace.
type SQLActionStore struct {
	sql    legacysql.LegacyDatabaseProvider
	tracer tracing.Tracer
}

func NewSQLActionStore(sql legacysql.LegacyDatabaseProvider, tracer tracing.Tracer) *SQLActionStore {
	return &SQLActionStore{sql: sql, tracer: tracer}
}

func (s *SQLActionStore) GetUserActions(ctx context.Context, ns claims.NamespaceInfo, query ActionsQuery) ([]string, error) {
	ctx, span := s.tracer.Start(ctx, "iam.useractions.store.GetUserActions")
	defer span.End()

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	query.OrgID = ns.OrgID
	req := newGetActions(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryActions, req)
	if err != nil {
		return nil, err
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, err
	}
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	var actions []string
	for rows.Next() {
		var action string
		if err := rows.Scan(&action); err != nil {
			return nil, err
		}
		actions = append(actions, action)
	}

	return actions, rows.Err()
}
