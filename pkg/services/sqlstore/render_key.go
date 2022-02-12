package sqlstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

type renderKey struct {
	Id        int64
	UserId    int64
	OrgId     int64
	OrgRole   string
	Key       string
	Refreshed time.Time
	Created   time.Time
}

func (ss *SQLStore) FindAndRefreshRenderKey(ctx context.Context, query *models.FindAndRefreshRenderKeyCommand) error {
	existingKey := ""

	err := ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		existing := &renderKey{}

		sess.Where("org_id = ? AND user_id = ? AND org_role = ?", query.RenderUser.OrgID, query.RenderUser.UserID, query.RenderUser.OrgRole)
		sess.OrderBy("refreshed DESC")
		minRefreshedAt := time.Now().Add(-query.MaxAge)

		found, err := sess.Get(existing)

		if err != nil {
			return err
		}

		if found != true || existing.Refreshed.Before(minRefreshedAt) {
			return nil
		}

		now := time.Now()

		existingKey = existing.Key
		existing.Refreshed = now
		_, err = sess.ID(existing.Id).Update(existing)
		if err != nil {
			return err
		}

		return nil
	})

	query.Result = &existingKey
	return err
}

func (ss *SQLStore) FindRenderUser(ctx context.Context, query *models.FindRenderUserQuery) error {
	err := ss.WithDbSession(ctx, func(sess *DBSession) error {
		sess.MustLogSQL(true)

		existing := &renderKey{}

		sess.Where("key = ?", query.RenderKey)
		sess.OrderBy("refreshed DESC")

		minRefreshedAt := time.Now().Add(-query.MaxAge)

		sess.Where("refreshed > ?", minRefreshedAt.Unix())

		found, err := sess.Get(existing)
		if err != nil {
			return err
		}

		if found && existing.Refreshed.After(minRefreshedAt) {
			query.Result = &models.RenderUser{
				OrgID:   existing.OrgId,
				UserID:  existing.UserId,
				OrgRole: existing.OrgRole,
			}
		}

		return nil
	})

	return err
}

func (ss *SQLStore) SaveRenderKey(ctx context.Context, cmd *models.SaveRenderKeyCommand) error {
	err := ss.WithDbSession(ctx, func(sess *DBSession) error {
		now := time.Now()
		newRenderKey := &renderKey{
			Id:        0,
			UserId:    cmd.RenderUser.UserID,
			OrgId:     cmd.RenderUser.OrgID,
			OrgRole:   cmd.RenderUser.OrgRole,
			Key:       cmd.RenderKey,
			Refreshed: now,
			Created:   now,
		}
		affected, err := sess.Insert(newRenderKey)
		cmd.Result = &affected
		return err
	})

	return err
}
