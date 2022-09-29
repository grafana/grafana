package tempuserimpl

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

type sqlxStore struct {
	sess *session.SessionDB
}

func (ss *sqlxStore) UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error {
	_, err := ss.sess.Exec(ctx, "UPDATE temp_user SET status=? WHERE code=?", string(cmd.Status), cmd.Code)
	return err
}

func (ss *sqlxStore) CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	now := time.Now()
	user := &models.TempUser{
		Email:           cmd.Email,
		Name:            cmd.Name,
		OrgId:           cmd.OrgId,
		Code:            cmd.Code,
		Role:            cmd.Role,
		Status:          cmd.Status,
		RemoteAddr:      cmd.RemoteAddr,
		InvitedByUserId: cmd.InvitedByUserId,
		EmailSentOn:     now,
		Created:         now.Unix(),
		Updated:         now.Unix(),
		Version:         0,
	}
	query := `INSERT INTO temp_user (
		email, 
		name, 
		org_id, 
		code, 
		role, 
		status, 
		remote_addr,
		invited_by_user_id,
		email_sent_on,
		created,
		updated, 
		version,
		email_sent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	var err error
	user.Id, err = ss.sess.ExecWithReturningId(
		ctx, query, user.Email, user.Name, user.OrgId, user.Code,
		user.Role, user.Status, user.RemoteAddr, user.InvitedByUserId,
		user.EmailSentOn, user.Created, user.Updated, user.Version, user.EmailSent)
	cmd.Result = user
	return err
}

func (ss *sqlxStore) UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error {
	_, err := ss.sess.Exec(ctx, "UPDATE temp_user SET email_sent=?, email_sent_on=? WHERE code=?", true, time.Now(), cmd.Code)
	return err
}

func (ss *sqlxStore) GetTempUsersQuery(ctx context.Context, query *models.GetTempUsersQuery) error {
	rawSQL := `SELECT
					tu.id     		  as id,
					tu.org_id 		  as org_id,
					tu.email  		  as email,
					tu.name           as name,
					tu.role           as role,
					tu.code           as code,
					tu.status         as status,
					tu.email_sent     as email_sent,
					tu.email_sent_on  as email_sent_on,
					CAST(tu.created as DATETIME) as created,
					u.login			  as invited_by_login,
					u.name			  as invited_by_name,
					u.email			  as invited_by_email
			    FROM "temp_user" as tu
				LEFT OUTER JOIN "user" as u on u.id = tu.invited_by_user_id
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
	return ss.sess.Select(ctx, &query.Result, rawSQL, params...)
}

func (ss *sqlxStore) GetTempUserByCode(ctx context.Context, query *models.GetTempUserByCodeQuery) error {
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
						tu.created		  as created,
						u.login			  as invited_by_login,
						u.name			  as invited_by_name,
						u.email			  as invited_by_email
					FROM "temp_user" as tu
					LEFT OUTER JOIN "user" as u on u.id = tu.invited_by_user_id
					WHERE tu.code=?`
	var tempUser models.TempUserDTO
	err := ss.sess.Get(ctx, &tempUser, rawSQL, query.Code)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.ErrTempUserNotFound
		}
	} else {
		query.Result = &tempUser
	}
	return err
}

func (ss *sqlxStore) ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error {
	rawSQL := "UPDATE temp_user SET status = ?, updated = ? WHERE created <= ? AND status in (?, ?)"
	if result, err := ss.sess.Exec(ctx, rawSQL, string(models.TmpUserExpired), time.Now().Unix(), cmd.OlderThan, string(models.TmpUserSignUpStarted), string(models.TmpUserInvitePending)); err != nil {
		return err
	} else if cmd.NumExpired, err = result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
