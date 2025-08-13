package shorturlimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/user"
)

type store interface {
	Get(ctx context.Context, user *user.SignedInUser, uid string) (*shorturls.ShortUrl, error)
	Update(ctx context.Context, shortURL *shorturls.ShortUrl) error
	Insert(ctx context.Context, shortURL *shorturls.ShortUrl) error
	Delete(ctx context.Context, cmd *shorturls.DeleteShortUrlCommand) error
}

type sqlStore struct {
	db db.DB
}

func (s sqlStore) Get(ctx context.Context, user *user.SignedInUser, uid string) (*shorturls.ShortUrl, error) {
	var shortURL shorturls.ShortUrl
	err := s.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err := dbSession.Where("org_id=? AND uid=?", user.OrgID, uid).Get(&shortURL)
		if err != nil {
			return err
		}
		if !exists {
			return shorturls.ErrShortURLNotFound.Errorf("short URL not found")
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return &shortURL, nil
}

func (s sqlStore) Update(ctx context.Context, shortURL *shorturls.ShortUrl) error {
	shortURL.LastSeenAt = getTime().Unix()
	return s.db.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		_, err := dbSession.ID(shortURL.Id).Update(shortURL)
		if err != nil {
			return err
		}
		return nil
	})
}

func (s sqlStore) Insert(ctx context.Context, shortURL *shorturls.ShortUrl) error {
	return s.db.WithDbSession(ctx, func(session *db.Session) error {
		_, err := session.Insert(shortURL)
		return err
	})
}

func (s sqlStore) Delete(ctx context.Context, cmd *shorturls.DeleteShortUrlCommand) error {
	// If a UID is provided, delete that specific short URL
	if cmd.Uid != "" {
		return s.db.WithTransactionalDbSession(ctx, func(session *db.Session) error {
			var rawSql = "DELETE FROM short_url WHERE uid = ?"

			if result, err := session.Exec(rawSql, cmd.Uid); err != nil {
				return err
			} else if cmd.NumDeleted, err = result.RowsAffected(); err != nil {
				return err
			}
			return nil
		})
	}

	// Otherwise, delete all stale short URLs older than the specified time
	return s.db.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		var rawSql = "DELETE FROM short_url WHERE created_at <= ? AND (last_seen_at IS NULL OR last_seen_at = 0)"

		if result, err := session.Exec(rawSql, cmd.OlderThan.Unix()); err != nil {
			return err
		} else if cmd.NumDeleted, err = result.RowsAffected(); err != nil {
			return err
		}
		return nil
	})
}
