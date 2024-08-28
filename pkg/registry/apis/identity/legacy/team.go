package legacy

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/registry/apis/identity/common"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type ListTeamQuery struct {
	OrgID int64
	UID   string

	Pagination common.Pagination
}

type ListTeamResult struct {
	Teams    []team.Team
	Continue int64
	RV       int64
}

var sqlQueryTeamsTemplate = mustTemplate("teams_query.sql")

type listTeamsQuery struct {
	sqltemplate.SQLTemplate
	Query     *ListTeamQuery
	TeamTable string
}

func newListTeams(sql *legacysql.LegacyDatabaseHelper, q *ListTeamQuery) listTeamsQuery {
	return listTeamsQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		TeamTable:   sql.Table("team"),
		Query:       q,
	}
}

func (r listTeamsQuery) Validate() error {
	return nil // TODO
}

// ListTeams implements LegacyIdentityStore.
func (s *legacySQLStore) ListTeams(ctx context.Context, ns claims.NamespaceInfo, query ListTeamQuery) (*ListTeamResult, error) {
	// for continue
	query.Pagination.Limit += 1
	query.OrgID = ns.OrgID
	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newListTeams(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryTeamsTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryTeamsTemplate.Name(), err)
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	res := &ListTeamResult{}
	if err != nil {
		return nil, err
	}

	var lastID int64
	for rows.Next() {
		t := team.Team{}
		err = rows.Scan(&t.ID, &t.UID, &t.Name, &t.Email, &t.Created, &t.Updated)
		if err != nil {
			return res, err
		}

		lastID = t.ID
		res.Teams = append(res.Teams, t)
		if len(res.Teams) > int(query.Pagination.Limit)-1 {
			res.Teams = res.Teams[0 : len(res.Teams)-1]
			res.Continue = lastID
			break
		}
	}

	if query.UID == "" {
		res.RV, err = sql.GetResourceVersion(ctx, "team", "updated")
	}

	return res, err
}
