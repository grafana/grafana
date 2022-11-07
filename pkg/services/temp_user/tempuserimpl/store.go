package tempuserimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
)

type store interface {
	UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error
	CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error
	UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error
	GetTempUsersQuery(ctx context.Context, query *models.GetTempUsersQuery) error
	GetTempUserByCode(ctx context.Context, query *models.GetTempUserByCodeQuery) error
	ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error
}

type xormStore struct {
	db db.DB
}

func (ss *xormStore) UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = "UPDATE temp_user SET status=? WHERE code=?"
		_, err := sess.Exec(rawSQL, string(cmd.Status), cmd.Code)
		return err
	})
}

func (ss *xormStore) CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// create user
		user := &models.TempUser{
			Email:           cmd.Email,
			Name:            cmd.Name,
			OrgId:           cmd.OrgId,
			Code:            cmd.Code,
			Role:            cmd.Role,
			Status:          cmd.Status,
			RemoteAddr:      cmd.RemoteAddr,
			InvitedByUserId: cmd.InvitedByUserId,
			EmailSentOn:     time.Now(),
			Created:         time.Now().Unix(),
			Updated:         time.Now().Unix(),
		}

		if _, err := sess.Insert(user); err != nil {
			return err
		}

		cmd.Result = user

		return nil
	})
}

func (ss *xormStore) UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		user := &models.TempUser{
			EmailSent:   true,
			EmailSentOn: time.Now(),
		}

		_, err := sess.Where("code = ?", cmd.Code).Cols("email_sent", "email_sent_on").Update(user)

		return err
	})
}

func (ss *xormStore) GetTempUsersQuery(ctx context.Context, query *models.GetTempUsersQuery) error {
	return ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		rawSQL := `SELECT
	                tu.id             as id,
	                tu.org_id         as org_id,
	                tu.email          as email,
									tu.name           as name,
									tu.role           as role,
									tu.code           as code,
									tu.status         as status,
									tu.email_sent     as email_sent,
									tu.email_sent_on  as email_sent_on,
									tu.created				as created,
									u.login						as invited_by_login,
									u.name						as invited_by_name,
									u.email						as invited_by_email
	                FROM ` + ss.db.GetDialect().Quote("temp_user") + ` as tu
									LEFT OUTER JOIN ` + ss.db.GetDialect().Quote("user") + ` as u on u.id = tu.invited_by_user_id
									WHERE tu.status=?`
		params := []interface{}{string(query.Status)}

		if query.OrgId > 0 {
			rawSQL += ` AND tu.org_id=?`
			params = append(params, query.OrgId)
		}

		if query.Email != "" {
			rawSQL += ` AND tu.email=?`
			params = append(params, query.Email)
		}

		rawSQL += " ORDER BY tu.created desc"

		query.Result = make([]*models.TempUserDTO, 0)
		sess := dbSess.SQL(rawSQL, params...)
		err := sess.Find(&query.Result)
		return err
	})
}

func (ss *xormStore) GetTempUserByCode(ctx context.Context, query *models.GetTempUserByCodeQuery) error {
	return ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		var rawSQL = `SELECT
	                tu.id             as id,
	                tu.org_id         as org_id,
	                tu.email          as email,
									tu.name           as name,
									tu.role           as role,
									tu.code           as code,
									tu.status         as status,
									tu.email_sent     as email_sent,
									tu.email_sent_on  as email_sent_on,
									tu.created				as created,
									u.login						as invited_by_login,
									u.name						as invited_by_name,
									u.email						as invited_by_email
	                FROM ` + ss.db.GetDialect().Quote("temp_user") + ` as tu
									LEFT OUTER JOIN ` + ss.db.GetDialect().Quote("user") + ` as u on u.id = tu.invited_by_user_id
	                WHERE tu.code=?`

		var tempUser models.TempUserDTO
		sess := dbSess.SQL(rawSQL, query.Code)
		has, err := sess.Get(&tempUser)

		if err != nil {
			return err
		} else if !has {
			return models.ErrTempUserNotFound
		}

		query.Result = &tempUser
		return err
	})
}

func (ss *xormStore) ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = "UPDATE temp_user SET status = ?, updated = ? WHERE created <= ? AND status in (?, ?)"
		if result, err := sess.Exec(rawSQL, string(models.TmpUserExpired), time.Now().Unix(), cmd.OlderThan.Unix(), string(models.TmpUserSignUpStarted), string(models.TmpUserInvitePending)); err != nil {
			return err
		} else if cmd.NumExpired, err = result.RowsAffected(); err != nil {
			return err
		}
		return nil
	})
}
