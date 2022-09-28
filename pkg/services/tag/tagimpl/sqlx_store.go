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
	for _, tagelement := range tags {
		var existingTag tag.Tag
		err := s.sess.Get(ctx, &existingTag, `SELECT * FROM tag WHERE "key"=? AND "value"=?`, tagelement.Key, tagelement.Value)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				tagelement.Id, err = s.sess.ExecWithReturningId(ctx, `INSERT INTO tag ("key", "value") VALUES (?, ?)`, tagelement.Key, tagelement.Value)
				if err != nil {
					return tags, err
				}
			} else {
				return tags, err
			}
		} else {
			tagelement.Id = existingTag.Id
		}
	}
	return tags, nil
}
