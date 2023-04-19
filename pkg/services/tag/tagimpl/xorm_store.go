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
			exists, err := s.innerGetTag(sess, tagElement)
			if err != nil {
				return err
			}
			if !exists {
				_, err := sess.Table("tag").Insert(tagElement)
				if err != nil {
					if s.db.GetDialect().IsUniqueConstraintViolation(err) {
						_, err := s.innerGetTag(sess, tagElement)
						return err
					}

					return err
				}
			}
		}
		return nil
	})
	return tags, err
}

func (s *sqlStore) innerGetTag(sess *db.Session, tagElement *tag.Tag) (bool, error) {
	var existingTag tag.Tag
	exists, err := sess.Table("tag").Where("`key`=? AND `value`=?", tagElement.Key, tagElement.Value).Get(&existingTag)
	if err != nil {
		return false, err
	}
	if !exists {
		return false, nil
	}

	tagElement.Id = existingTag.Id
	return true, nil
}
