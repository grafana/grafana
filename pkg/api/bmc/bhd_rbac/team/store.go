package team

import (
	"bytes"
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func getSelectedTeamCountSQL(whereClause string) string {
	var sql bytes.Buffer
	sql.WriteString(`select COUNT(distinct(t.id)) FILTER (where `)
	sql.WriteString(whereClause)
	sql.WriteString(`) AS totalCount, COUNT(distinct(t.id)) FILTER (where `)
	sql.WriteString(whereClause)
	sql.WriteString(` and r.bhd_role_id = ?) AS selectedCount  
	from public."team" t
			  left join team_bhd_role r
			  on t.id=r.team_id`)
	return sql.String()
}

func getTeamSearchSQL() string {
	return `select  t.id, t.name, t.is_msp_team, ARRAY_TO_JSON(ARRAY_AGG(r.bhd_role_id)) as bhd_role_ids from public."team" t
	        left join team_bhd_role r
	        on t.id=r.team_id`
}

func SearchTeam(ctx context.Context, store sqlstore.SQLStore, query *SearchTeamQuery) (*SearchTeamQueryResult, error) {
	queryResult := SearchTeamQueryResult{
		Teams: make([]TeamDTO, 0),
	}
	cntResult := make([]*CntResult, 0)
	var countSql bytes.Buffer

	err := store.WithDbSession(ctx, func(sess *db.Session) error {
		queryWithWildcards := "%" + query.Query + "%"

		whereConditions := make([]string, 0)
		whereParams := make([]interface{}, 0)

		whereConditions = append(whereConditions, "t.org_id = ?")
		whereParams = append(whereParams, query.OrgID)

		whereConditions = append(whereConditions, "t.is_msp_team = ?")
		whereParams = append(whereParams, false)

		if query.Query != "" {
			whereConditions = append(whereConditions, "(name "+store.GetDialect().LikeStr()+" ?)")
			whereParams = append(whereParams, queryWithWildcards)
		}

		if query.BHDRoleID != 0 && query.Selected {
			whereConditions = append(whereConditions, "r.bhd_role_id = ?")
			whereParams = append(whereParams, query.BHDRoleID)
		}

		var whereClause string = strings.Join(whereConditions, " AND ")
		var sql bytes.Buffer
		sql.WriteString(getTeamSearchSQL())
		sql.WriteString(" where ")
		sql.WriteString(whereClause)
		sql.WriteString(" group by t.id")
		sql.WriteString(" order by t.name")
		if query.Limit > 0 {
			offset := query.Limit * (query.Page - 1)
			sql.WriteString(store.GetDialect().LimitOffset(int64(query.Limit), int64(offset)))
		}
		err := sess.SQL(sql.String(), whereParams...).Find(&queryResult.Teams)
		if err != nil {
			return err
		}
		//get totalRecord Count and Count of records matching with role id, if provided
		countSql.WriteString(getSelectedTeamCountSQL(whereClause))
		whereParams = append(whereParams, whereParams...)
		whereParams = append(whereParams, query.BHDRoleID)
		cntErr := sess.SQL(countSql.String(), whereParams...).Find(&cntResult)
		if cntErr != nil {
			return cntErr
		}
		queryResult.TotalCount = cntResult[0].TotalCount
		queryResult.SelectedCount = cntResult[0].SelectedCount
		return err
	})

	if err != nil {
		return &SearchTeamQueryResult{}, err
	}

	for i := range queryResult.Teams {
		team := &queryResult.Teams[i]
		if len(team.BHDRoleIDs) > 0 && team.BHDRoleIDs[0] == 0 {
			team.BHDRoleIDs = []int64{}
		}
	}
	return &queryResult, err
}

func AddTeamBHDRole(ctx context.Context, store sqlstore.SQLStore, cmd *AddTeamRoleCommand) error {

	return store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// check if team exists
		if _, err := teamExists(cmd.OrgID, cmd.ID, sess); err != nil {
			return err
		}
		teamRoleMapping := BhdTeamRole{TeamId: cmd.ID, BhdRoleId: cmd.RoleId, OrgId: cmd.OrgID}
		if _, err := sess.Table("team_bhd_role").
			Insert(&teamRoleMapping); err != nil {
			return err
		}
		return nil
	})
}

// Bmc code - Rbac Team Role mapping
func RemoveTeamBHDRole(ctx context.Context, store sqlstore.SQLStore, cmd *AddTeamRoleCommand) error {

	return store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// check if team exists
		if _, err := teamExists(cmd.OrgID, cmd.ID, sess); err != nil {
			return err
		}
		var rawSql = "DELETE FROM team_bhd_role WHERE team_id = ? AND org_id = ? AND bhd_role_id = ?"
		_, err := sess.Exec(rawSql, cmd.ID, cmd.OrgID, cmd.RoleId)
		if err != nil {
			return err
		}
		return nil
	})
}

func teamExists(orgID int64, teamID int64, sess *db.Session) (bool, error) {
	if res, err := sess.Query("SELECT 1 from team WHERE org_id=? and id=?", orgID, teamID); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, ErrTeamNotFound
	}

	return true, nil
}
