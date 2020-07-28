package sqlstore

import (
	"errors"

	"github.com/grafana/grafana/pkg/models"
)

// Will insert if needed any new key/value pars and return ids
func EnsureTagsExist(sess *DBSession, tags []*models.Tag) ([]*models.Tag, error) {
	for _, tag := range tags {
		var existingTag models.Tag

		// check if it exists
		if exists, err := sess.Table("tag").Where("`key`=? AND `value`=?", tag.Key, tag.Value).Get(&existingTag); err != nil {
			return nil, err
		} else if exists {
			tag.Id = existingTag.Id
		} else {
			if _, err := sess.Table("tag").Insert(tag); err != nil {
				return nil, err
			}
		}
	}

	return tags, nil
}

func getTag(sess *DBSession, key string, val string) (*models.Tag, error) {
	var tag models.Tag

	if exists, err := sess.Table("tag").Where("`key`=? AND `value`=?", key, val).Get(&tag); err != nil {
		return nil, err
	} else if exists {
		return &tag, nil
	}
	return nil, errors.New("tag not found")
}
