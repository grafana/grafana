package sqlstore

import "github.com/grafana/grafana/pkg/models"

// Will insert if needed any new key/value pars and return ids
func EnsureTagsExist(sess *DBSession, tags []*models.Tag) ([]*models.Tag, error) {
	for _, tag := range tags {
		var existingTag models.Tag

		// check if it exists
		exists, err := sess.Table("tag").Where("`key`=? AND `value`=?", tag.Key, tag.Value).Get(&existingTag)
		if err != nil {
			return nil, err
		}
		if exists {
			tag.Id = existingTag.Id
		} else {
			_, err := sess.Table("tag").Insert(tag)
			if err != nil {
				return nil, err
			}
		}
	}

	return tags, nil
}
