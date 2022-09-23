package tagimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/tag"
)

type store interface {
	EnsureTagsExist(context.Context, []*tag.Tag) ([]*tag.Tag, error)
}

type sqlStore struct {
	db db.DB
}

func (s *sqlStore) EnsureTagsExist(ctx context.Context, tags []*tag.Tag) ([]*tag.Tag, error) {
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		for _, tagelement := range tags {
			var existingTag tag.Tag
			exists, err := sess.Table("tag").Where("`key`=? AND `value`=?", tagelement.Key, tagelement.Value).Get(&existingTag)
			if err != nil {
				return err
			}
			if exists {
				tagelement.Id = existingTag.Id
			} else {
				_, err := sess.Table("tag").Insert(tagelement)
				if err != nil {
					return err
				}
			}
		}
		return nil
	})
	return tags, err
}
