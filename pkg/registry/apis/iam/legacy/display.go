package legacy

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type ListDisplayQuery struct {
	OrgID int64
	UIDs  []string
	IDs   []int64
}

var sqlQueryDisplayTemplate = mustTemplate("display_query.sql")

func newListDisplay(sql *legacysql.LegacyDatabaseHelper, q *ListDisplayQuery) listDisplayQuery {
	return listDisplayQuery{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
		Query:        q,
	}
}

type listDisplayQuery struct {
	sqltemplate.SQLTemplate
	Query        *ListDisplayQuery
	UserTable    string
	OrgUserTable string
}

func (r listDisplayQuery) Validate() error {
	return nil // TODO
}

// GetDisplay implements LegacyIdentityStore.
func (s *legacySQLStore) ListDisplay(ctx context.Context, ns claims.NamespaceInfo, query ListDisplayQuery) (*ListUserResult, error) {
	query.OrgID = ns.OrgID
	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	return s.queryUsers(ctx, sql, sqlQueryDisplayTemplate, newListDisplay(sql, &query), 10000)
}
