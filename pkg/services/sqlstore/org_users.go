package sqlstore

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util"
)

func (ss *SQLStore) addOrgUsersQueryAndCommandHandlers() {
	bus.AddHandler("sql", ss.UpdateOrgUser)
}

func (ss *SQLStore) UpdateOrgUser(ctx context.Context, cmd *models.UpdateOrgUserCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		var orgUser models.OrgUser
		exists, err := sess.Where("org_id=? AND user_id=?", cmd.OrgId, cmd.UserId).Get(&orgUser)
		if err != nil {
			return err
		}

		if !exists {
			return models.ErrOrgUserNotFound
		}

		orgUser.Role = cmd.Role
		orgUser.Updated = time.Now()
		_, err = sess.ID(orgUser.Id).Update(&orgUser)
		if err != nil {
			return err
		}

		return validateOneAdminLeftInOrg(cmd.OrgId, sess)
	})
}

func (ss *SQLStore) SearchOrgUsers(ctx context.Context, query *models.SearchOrgUsersQuery) error {
	query.Result = models.SearchOrgUsersQueryResult{
		OrgUsers: make([]*models.OrgUserDTO, 0),
	}

	sess := x.Table("org_user")
	sess.Join("INNER", x.Dialect().Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", x.Dialect().Quote("user")))

	whereConditions := make([]string, 0)
	whereParams := make([]interface{}, 0)

	whereConditions = append(whereConditions, "org_user.org_id = ?")
	whereParams = append(whereParams, query.OrgID)

	// TODO: add to chore, for cleaning up after we have created
	// service accounts table in the modelling
	whereConditions = append(whereConditions, fmt.Sprintf("%s.is_service_account = %t", x.Dialect().Quote("user"), query.IsServiceAccount))

	if ss.Cfg.IsFeatureToggleEnabled(featuremgmt.FlagAccesscontrol) {
		acFilter, err := accesscontrol.Filter(ctx, "org_user.user_id", "users", "org.users:read", query.User)
		if err != nil {
			return err
		}
		whereConditions = append(whereConditions, acFilter.Where)
		whereParams = append(whereParams, acFilter.Args...)
	}

	if query.Query != "" {
		queryWithWildcards := "%" + query.Query + "%"
		whereConditions = append(whereConditions, "(email "+dialect.LikeStr()+" ? OR name "+dialect.LikeStr()+" ? OR login "+dialect.LikeStr()+" ?)")
		whereParams = append(whereParams, queryWithWildcards, queryWithWildcards, queryWithWildcards)
	}

	if len(whereConditions) > 0 {
		sess.Where(strings.Join(whereConditions, " AND "), whereParams...)
	}

	if query.Limit > 0 {
		offset := query.Limit * (query.Page - 1)
		sess.Limit(query.Limit, offset)
	}

	sess.Cols(
		"org_user.org_id",
		"org_user.user_id",
		"user.email",
		"user.name",
		"user.login",
		"org_user.role",
		"user.last_seen_at",
	)
	sess.Asc("user.email", "user.login")

	if err := sess.Find(&query.Result.OrgUsers); err != nil {
		return err
	}

	// get total count
	orgUser := models.OrgUser{}
	countSess := x.Table("org_user").
		Join("INNER", x.Dialect().Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", x.Dialect().Quote("user")))

	if len(whereConditions) > 0 {
		countSess.Where(strings.Join(whereConditions, " AND "), whereParams...)
	}

	count, err := countSess.Count(&orgUser)
	if err != nil {
		return err
	}
	query.Result.TotalCount = count

	for _, user := range query.Result.OrgUsers {
		user.LastSeenAtAge = util.GetAgeString(user.LastSeenAt)
	}

	return nil
}

func validateOneAdminLeftInOrg(orgId int64, sess *DBSession) error {
	// validate that there is an admin user left
	res, err := sess.Query("SELECT 1 from org_user WHERE org_id=? and role='Admin'", orgId)
	if err != nil {
		return err
	}

	if len(res) == 0 {
		return models.ErrLastOrgAdmin
	}

	return err
}
