package tagimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/tag"
)

type sqlStore struct {
	db db.DB
}

func (s *sqlStore) EnsureTagsExist(ctx context.Context, tags []*tag.Tag) ([]*tag.Tag, error) {
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		for _, tagElement := range tags {
			var existingTag tag.Tag
			exists, err := sess.Table("tag").Where("`key`=? AND `value`=?", tagElement.Key, tagElement.Value).Get(&existingTag)
			if err != nil {
				return err
			}
			if exists {
				tagElement.Id = existingTag.Id
			} else {
				_, err := sess.Table("tag").Insert(tagElement)
				if err != nil {
					return err
				}
			}
		}
		return nil
	})
	return tags, err
}
