package tagimpl

import (
	"context"
	"database/sql"
	"errors"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/tag"
)

type sqlxStore struct {
	sess *session.SessionDB
}

func (s *sqlxStore) EnsureTagsExist(ctx context.Context, tags []*tag.Tag) ([]*tag.Tag, error) {
	for _, tagElement := range tags {
		var existingTag tag.Tag
		err := s.sess.Get(ctx, &existingTag, `SELECT * FROM tag WHERE "key"=? AND "value"=?`, tagElement.Key, tagElement.Value)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				tagElement.Id, err = s.sess.ExecWithReturningId(ctx, `INSERT INTO tag ("key", "value") VALUES (?, ?)`, tagElement.Key, tagElement.Value)
				if err != nil {
					return tags, err
				}
			} else {
				return tags, err
			}
		} else {
			tagElement.Id = existingTag.Id
		}
	}
	return tags, nil
}
