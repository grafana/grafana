package legacy

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	_ LegacyIdentityStore = (*legacySQLStore)(nil)
)

func NewLegacySQLStores(sql legacysql.LegacyDatabaseProvider) LegacyIdentityStore {
	return &legacySQLStore{
		sql: sql,
	}
}

type legacySQLStore struct {
	sql legacysql.LegacyDatabaseProvider
}

// ListTeamMembers implements LegacyIdentityStore.
func (s *legacySQLStore) ListTeamMembers(ctx context.Context, ns claims.NamespaceInfo, query ListTeamMembersQuery) (*ListTeamMembersResult, error) {
	query.Pagination.Limit += 1
	query.OrgID = ns.OrgID
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newListTeamMembers(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryTeamMembers, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryTeamsTemplate.Name(), err)
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	if err != nil {
		return nil, err
	}

	res := &ListTeamMembersResult{}
	var lastID int64
	for rows.Next() {
		m, err := scanMember(rows)
		if err != nil {
			return nil, err
		}

		lastID = m.ID
		res.Members = append(res.Members, m)
		if len(res.Members) > int(query.Pagination.Limit)-1 {
			res.Continue = lastID
			res.Members = res.Members[0 : len(res.Members)-1]
			break
		}
	}

	return res, err
}

func scanMember(rows *sql.Rows) (TeamMember, error) {
	m := TeamMember{}
	err := rows.Scan(&m.ID, &m.TeamUID, &m.TeamID, &m.UserUID, &m.UserID, &m.Name, &m.Email, &m.Username, &m.External, &m.Created, &m.Updated, &m.Permission)
	return m, err
}

// GetUserTeams implements LegacyIdentityStore.
func (s *legacySQLStore) GetUserTeams(ctx context.Context, ns claims.NamespaceInfo, uid string) ([]team.Team, error) {
	panic("unimplemented")
}
