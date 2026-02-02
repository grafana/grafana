package user

import (
	"bytes"
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

const ViewerRole int64 = 3

func getSelectedUserCountSQL(whereClause string) string {
	var sql bytes.Buffer
	sql.WriteString(`select COUNT(distinct(u.id)) FILTER (where `)
	sql.WriteString(whereClause)
	sql.WriteString(`) AS totalCount, COUNT(distinct(u.id)) FILTER (where `)
	sql.WriteString(whereClause)
	sql.WriteString(` and r.bhd_role_id = ?) AS selectedCount  
	from public."user" u
			  left join user_bhd_role r
			  on u.id=r.user_id`)
	return sql.String()
}

func getUserSearchSQL() string {
	return `select  u.id, u.name, u.email, u.login,  ARRAY_TO_JSON(ARRAY_AGG(r.bhd_role_id)) as bhd_role_ids from public."user" u
	        left join user_bhd_role r
	        on u.id=r.user_id`

}

func SearchUsers(ctx context.Context, store sqlstore.SQLStore, query *SearchUsersQuery) (*SearchUserQueryResult, error) {
	queryResult := SearchUserQueryResult{
		Users: make([]UserDTO, 0),
	}
	cntResult := make([]*CntResult, 0)
	var countSql bytes.Buffer

	err := store.WithDbSession(ctx, func(sess *db.Session) error {
		queryWithWildcards := "%" + query.Query + "%"

		whereConditions := make([]string, 0)
		whereParams := make([]interface{}, 0)

		whereConditions = append(whereConditions, "u.org_id = ?")
		whereParams = append(whereParams, query.OrgID)

		if query.Query != "" {
			whereConditions = append(whereConditions, "(email "+store.GetDialect().LikeStr()+" ? OR name "+store.GetDialect().LikeStr()+" ? OR login "+store.GetDialect().LikeStr()+" ?)")
			whereParams = append(whereParams, queryWithWildcards, queryWithWildcards, queryWithWildcards)
		}

		//Users will not be filtered based on role if role id is 3, which is the viewer role, because each user in the dashboard is by default a viewer.
		if query.BHDRoleID != 0 && query.BHDRoleID != ViewerRole && query.Selected {
			whereConditions = append(whereConditions, "r.bhd_role_id = ?")
			whereParams = append(whereParams, query.BHDRoleID)
		}

		var whereClause string = strings.Join(whereConditions, " AND ")
		var sql bytes.Buffer
		sql.WriteString(getUserSearchSQL())
		sql.WriteString(" where ")
		sql.WriteString(whereClause)
		sql.WriteString(" group by u.id")
		sql.WriteString(" order by u.login")
		if query.Limit > 0 {
			offset := query.Limit * (query.Page - 1)
			sql.WriteString(store.GetDialect().LimitOffset(int64(query.Limit), int64(offset)))
		}
		err := sess.SQL(sql.String(), whereParams...).Find(&queryResult.Users)
		if err != nil {
			return err
		}
		//get totalRecord Count and Count of records matching with role id, if provided
		countSql.WriteString(getSelectedUserCountSQL(whereClause))
		whereParams = append(whereParams, whereParams...)
		whereParams = append(whereParams, query.BHDRoleID)
		cntErr := sess.SQL(countSql.String(), whereParams...).Find(&cntResult)
		if cntErr != nil {
			return cntErr
		}
		queryResult.TotalCount = cntResult[0].TotalCount

		//Selected count should be same as that of total count in case of viewer role.
		if query.BHDRoleID == ViewerRole {
			queryResult.SelectedCount = cntResult[0].TotalCount
		} else {
			queryResult.SelectedCount = cntResult[0].SelectedCount
		}

		return err
	})

	if err != nil {
		return &SearchUserQueryResult{}, err
	}
	for i := range queryResult.Users {
		user := &queryResult.Users[i]
		if len(user.BHDRoleIDs) > 0 && user.BHDRoleIDs[0] == 0 {
			user.BHDRoleIDs = []int64{ViewerRole}
		} else {
			if !contains(user.BHDRoleIDs, ViewerRole) {
				user.BHDRoleIDs = append(user.BHDRoleIDs, ViewerRole)
			}
		}
	}
	return &queryResult, err
}

func AddUserBHDRole(ctx context.Context, store sqlstore.SQLStore, cmd *UserRoleMappingCommand) error {

	return store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		userRoleMapping := BhdUserRole{UserId: cmd.ID, BhdRoleId: cmd.RoleId, OrgId: cmd.OrgID}
		if _, err := sess.Table("user_bhd_role").
			Insert(&userRoleMapping); err != nil {
			return err
		}
		return nil
	})
}

func RemoveUserBHDRole(ctx context.Context, store sqlstore.SQLStore, cmd *UserRoleMappingCommand) error {
	return store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		whereParams := make([]interface{}, 0)
		whereParams = append(whereParams, cmd.ID)
		whereParams = append(whereParams, cmd.OrgID)
		var sql = "DELETE FROM user_bhd_role WHERE user_id = ? AND org_id = ?"
		if cmd.RoleId > 0 {
			sql = "DELETE FROM user_bhd_role WHERE user_id = ? AND org_id = ? AND bhd_role_id = ?"
			whereParams = append(whereParams, cmd.RoleId)
		}
		var t int
		_, err := sess.SQL(sql, whereParams...).Count(&t)

		if err != nil {
			return err
		}
		return nil
	})
}

func contains(slice []int64, element int64) bool {
	for _, item := range slice {
		if item == element {
			return true
		}
	}
	return false
}
