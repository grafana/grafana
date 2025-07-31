package tempuserimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/setting"
)

type store interface {
	UpdateTempUserStatus(ctx context.Context, cmd *tempuser.UpdateTempUserStatusCommand) error
	CreateTempUser(ctx context.Context, cmd *tempuser.CreateTempUserCommand) (*tempuser.TempUser, error)
	UpdateTempUserWithEmailSent(ctx context.Context, cmd *tempuser.UpdateTempUserWithEmailSentCommand) error
	GetTempUsersQuery(ctx context.Context, query *tempuser.GetTempUsersQuery) ([]*tempuser.TempUserDTO, error)
	GetTempUserByCode(ctx context.Context, query *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error)
	ExpireOldUserInvites(ctx context.Context, cmd *tempuser.ExpireTempUsersCommand) error
	ExpireOldVerifications(ctx context.Context, cmd *tempuser.ExpireTempUsersCommand) error
	ExpirePreviousVerifications(ctx context.Context, cmd *tempuser.ExpirePreviousVerificationsCommand) error
}

type xormStore struct {
	db               db.DB
	settingsProvider setting.SettingsProvider
}

func (ss *xormStore) UpdateTempUserStatus(ctx context.Context, cmd *tempuser.UpdateTempUserStatusCommand) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := "UPDATE temp_user SET status=? WHERE code=?"
		_, err := sess.Exec(rawSQL, string(cmd.Status), cmd.Code)
		return err
	})
}

func (ss *xormStore) CreateTempUser(ctx context.Context, cmd *tempuser.CreateTempUserCommand) (*tempuser.TempUser, error) {
	var queryResult *tempuser.TempUser
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		// create user
		user := &tempuser.TempUser{
			Email:           cmd.Email,
			Name:            cmd.Name,
			OrgID:           cmd.OrgID,
			Code:            cmd.Code,
			Role:            cmd.Role,
			Status:          cmd.Status,
			RemoteAddr:      cmd.RemoteAddr,
			InvitedByUserID: cmd.InvitedByUserID,
			EmailSentOn:     time.Now(),
			Created:         time.Now().Unix(),
			Updated:         time.Now().Unix(),
		}

		if _, err := sess.Insert(user); err != nil {
			return err
		}

		queryResult = user

		return nil
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

func (ss *xormStore) UpdateTempUserWithEmailSent(ctx context.Context, cmd *tempuser.UpdateTempUserWithEmailSentCommand) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		user := &tempuser.TempUser{
			EmailSent:   true,
			EmailSentOn: time.Now(),
		}

		_, err := sess.Where("code = ?", cmd.Code).Cols("email_sent", "email_sent_on").Update(user)

		return err
	})
}

func (ss *xormStore) GetTempUsersQuery(ctx context.Context, query *tempuser.GetTempUsersQuery) ([]*tempuser.TempUserDTO, error) {
	queryResult := make([]*tempuser.TempUserDTO, 0)
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
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
		params := []any{string(query.Status)}

		if query.OrgID > 0 {
			rawSQL += ` AND tu.org_id=?`
			params = append(params, query.OrgID)
		}

		if query.Email != "" {
			rawSQL += ` AND LOWER(tu.email)=LOWER(?)`
			params = append(params, query.Email)
		}

		rawSQL += " ORDER BY tu.created desc"

		sess := dbSess.SQL(rawSQL, params...)
		err := sess.Find(&queryResult)
		return err
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

func (ss *xormStore) GetTempUserByCode(ctx context.Context, query *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error) {
	var queryResult *tempuser.TempUserDTO
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
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
					tu.created		  as created,
					tu.invited_by_user_id  as invited_by_id,
					u.login			  as invited_by_login,
					u.name		      as invited_by_name,
					u.email			  as invited_by_email
	                FROM ` + ss.db.GetDialect().Quote("temp_user") + ` as tu
						LEFT OUTER JOIN ` + ss.db.GetDialect().Quote("user") + ` as u on u.id = tu.invited_by_user_id
	                WHERE tu.code=?`

		var tempUser tempuser.TempUserDTO
		sess := dbSess.SQL(rawSQL, query.Code)
		has, err := sess.Get(&tempUser)

		if err != nil {
			return err
		} else if !has {
			return tempuser.ErrTempUserNotFound
		}

		queryResult = &tempUser
		return err
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

func (ss *xormStore) ExpireOldUserInvites(ctx context.Context, cmd *tempuser.ExpireTempUsersCommand) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := "UPDATE temp_user SET status = ?, updated = ? WHERE created <= ? AND status in (?, ?)"
		if result, err := sess.Exec(rawSQL, string(tempuser.TmpUserExpired), time.Now().Unix(), cmd.OlderThan.Unix(), string(tempuser.TmpUserSignUpStarted), string(tempuser.TmpUserInvitePending)); err != nil {
			return err
		} else if cmd.NumExpired, err = result.RowsAffected(); err != nil {
			return err
		}
		return nil
	})
}

func (ss *xormStore) ExpireOldVerifications(ctx context.Context, cmd *tempuser.ExpireTempUsersCommand) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := "UPDATE temp_user SET status = ?, updated = ? WHERE created <= ? AND status = ?"
		if result, err := sess.Exec(rawSQL, string(tempuser.TmpUserEmailUpdateExpired), time.Now().Unix(), cmd.OlderThan.Unix(), string(tempuser.TmpUserEmailUpdateStarted)); err != nil {
			return err
		} else if cmd.NumExpired, err = result.RowsAffected(); err != nil {
			return err
		}
		return nil
	})
}

func (ss *xormStore) ExpirePreviousVerifications(ctx context.Context, cmd *tempuser.ExpirePreviousVerificationsCommand) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := "UPDATE temp_user SET status = ?, updated = ? WHERE invited_by_user_id = ? AND status = ?"
		if result, err := sess.Exec(rawSQL, string(tempuser.TmpUserEmailUpdateExpired), time.Now().Unix(), cmd.InvitedByUserID, string(tempuser.TmpUserEmailUpdateStarted)); err != nil {
			return err
		} else if cmd.NumExpired, err = result.RowsAffected(); err != nil {
			return err
		}
		return nil
	})
}
