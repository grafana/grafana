package sqlstore

import (
	"bytes"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
)

type SqlAnnotationRepo struct {
}

func (r *SqlAnnotationRepo) Save(item *annotations.Item) error {
	return inTransaction(func(sess *DBSession) error {
		tags := models.ParseTagPairs(item.Tags)
		item.Tags = models.JoinTagPairs(tags)
		if _, err := sess.Table("annotation").Insert(item); err != nil {
			return err
		}

		if item.Tags != nil {
			if tags, err := r.ensureTagsExist(sess, tags); err != nil {
				return err
			} else {
				for _, tag := range tags {
					if _, err := sess.Exec("INSERT INTO annotation_tag (annotation_id, tag_id) VALUES(?,?)", item.Id, tag.Id); err != nil {
						return err
					}
				}
			}
		}

		return nil
	})
}

// Will insert if needed any new key/value pars and return ids
func (r *SqlAnnotationRepo) ensureTagsExist(sess *DBSession, tags []*models.Tag) ([]*models.Tag, error) {
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

func (r *SqlAnnotationRepo) Update(item *annotations.Item) error {
	return inTransaction(func(sess *DBSession) error {
		var (
			isExist bool
			err     error
		)
		existing := new(annotations.Item)

		if item.Id == 0 && item.RegionId != 0 {
			// Update region end time
			isExist, err = sess.Table("annotation").Where("region_id=? AND id!=? AND org_id=?", item.RegionId, item.RegionId, item.OrgId).Get(existing)
		} else {
			isExist, err = sess.Table("annotation").Where("id=? AND org_id=?", item.Id, item.OrgId).Get(existing)
		}

		if err != nil {
			return err
		}
		if !isExist {
			return errors.New("Annotation not found")
		}

		existing.Epoch = item.Epoch
		existing.Text = item.Text
		if item.RegionId != 0 {
			existing.RegionId = item.RegionId
		}

		if item.Tags != nil {
			if tags, err := r.ensureTagsExist(sess, models.ParseTagPairs(item.Tags)); err != nil {
				return err
			} else {
				if _, err := sess.Exec("DELETE FROM annotation_tag WHERE annotation_id = ?", existing.Id); err != nil {
					return err
				}
				for _, tag := range tags {
					if _, err := sess.Exec("INSERT INTO annotation_tag (annotation_id, tag_id) VALUES(?,?)", existing.Id, tag.Id); err != nil {
						return err
					}
				}
			}
		}

		existing.Tags = item.Tags

		if _, err := sess.Table("annotation").Id(existing.Id).Cols("epoch", "text", "region_id", "tags").Update(existing); err != nil {
			return err
		}

		return nil
	})
}

func (r *SqlAnnotationRepo) Find(query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`
		SELECT
			annotation.id,
			annotation.epoch as time,
			annotation.dashboard_id,
			annotation.panel_id,
			annotation.new_state,
			annotation.prev_state,
			annotation.alert_id,
			annotation.region_id,
			annotation.text,
			annotation.tags,
			annotation.data,
			usr.email,
			usr.login,
			alert.name as alert_name
		FROM annotation
		LEFT OUTER JOIN ` + dialect.Quote("user") + ` as usr on usr.id = annotation.user_id
		LEFT OUTER JOIN alert on alert.id = annotation.alert_id
		`)

	sql.WriteString(`WHERE annotation.org_id = ?`)
	params = append(params, query.OrgId)

	if query.AlertId != 0 {
		sql.WriteString(` AND annotation.alert_id = ?`)
		params = append(params, query.AlertId)
	}

	if query.DashboardId != 0 {
		sql.WriteString(` AND annotation.dashboard_id = ?`)
		params = append(params, query.DashboardId)
	}

	if query.PanelId != 0 {
		sql.WriteString(` AND annotation.panel_id = ?`)
		params = append(params, query.PanelId)
	}

	if query.From > 0 && query.To > 0 {
		sql.WriteString(` AND annotation.epoch BETWEEN ? AND ?`)
		params = append(params, query.From, query.To)
	}

	if query.Type == "alert" {
		sql.WriteString(` AND annotation.alert_id > 0`)
	}

	if len(query.Tags) > 0 {
		keyValueFilters := []string{}

		tags := models.ParseTagPairs(query.Tags)
		for _, tag := range tags {
			if tag.Value == "" {
				keyValueFilters = append(keyValueFilters, "(tag.key = ?)")
				params = append(params, tag.Key)
			} else {
				keyValueFilters = append(keyValueFilters, "(tag.key = ? AND tag.value = ?)")
				params = append(params, tag.Key, tag.Value)
			}
		}

		if len(tags) > 0 {
			tagsSubQuery := fmt.Sprintf(`
        SELECT SUM(1) FROM annotation_tag at
          INNER JOIN tag on tag.id = at.tag_id
          WHERE at.annotation_id = annotation.id
            AND (
              %s
            )
      `, strings.Join(keyValueFilters, " OR "))

			sql.WriteString(fmt.Sprintf(" AND (%s) = %d ", tagsSubQuery, len(tags)))
		}
	}

	if query.Limit == 0 {
		query.Limit = 10
	}

	sql.WriteString(fmt.Sprintf(" ORDER BY epoch DESC LIMIT %v", query.Limit))

	items := make([]*annotations.ItemDTO, 0)
	if err := x.Sql(sql.String(), params...).Find(&items); err != nil {
		return nil, err
	}

	return items, nil
}

func (r *SqlAnnotationRepo) Delete(params *annotations.DeleteParams) error {
	return inTransaction(func(sess *DBSession) error {
		var (
			sql         string
			annoTagSql  string
			queryParams []interface{}
		)

		if params.RegionId != 0 {
			annoTagSql = "DELETE FROM annotation_tag WHERE annotation_id IN (SELECT id FROM annotation WHERE region_id = ?)"
			sql = "DELETE FROM annotation WHERE region_id = ?"
			queryParams = []interface{}{params.RegionId}
		} else if params.Id != 0 {
			annoTagSql = "DELETE FROM annotation_tag WHERE annotation_id IN (SELECT id FROM annotation WHERE id = ?)"
			sql = "DELETE FROM annotation WHERE id = ?"
			queryParams = []interface{}{params.Id}
		} else {
			annoTagSql = "DELETE FROM annotation_tag WHERE annotation_id IN (SELECT id FROM annotation WHERE dashboard_id = ? AND panel_id = ?)"
			sql = "DELETE FROM annotation WHERE dashboard_id = ? AND panel_id = ?"
			queryParams = []interface{}{params.DashboardId, params.PanelId}
		}

		if _, err := sess.Exec(annoTagSql, queryParams...); err != nil {
			return err
		}

		if _, err := sess.Exec(sql, queryParams...); err != nil {
			return err
		}

		return nil
	})
}
