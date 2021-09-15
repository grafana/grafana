package sqlstore

import (
	"bytes"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
)

// Update the item so that EpochEnd >= Epoch
func validateTimeRange(item *annotations.Item) error {
	if item.EpochEnd == 0 {
		if item.Epoch == 0 {
			return annotations.ErrTimerangeMissing
		}
		item.EpochEnd = item.Epoch
	}
	if item.Epoch == 0 {
		item.Epoch = item.EpochEnd
	}
	if item.EpochEnd < item.Epoch {
		item.Epoch, item.EpochEnd = item.EpochEnd, item.Epoch
	}
	return nil
}

type SQLAnnotationRepo struct {
}

func (r *SQLAnnotationRepo) Save(item *annotations.Item) error {
	return inTransaction(func(sess *DBSession) error {
		tags := models.ParseTagPairs(item.Tags)
		item.Tags = models.JoinTagPairs(tags)
		item.Created = timeNow().UnixNano() / int64(time.Millisecond)
		item.Updated = item.Created
		if item.Epoch == 0 {
			item.Epoch = item.Created
		}
		if err := validateTimeRange(item); err != nil {
			return err
		}

		if _, err := sess.Table("annotation").Insert(item); err != nil {
			return err
		}

		if item.Tags != nil {
			tags, err := EnsureTagsExist(sess, tags)
			if err != nil {
				return err
			}
			for _, tag := range tags {
				if _, err := sess.Exec("INSERT INTO annotation_tag (annotation_id, tag_id) VALUES(?,?)", item.Id, tag.Id); err != nil {
					return err
				}
			}
		}

		return nil
	})
}

func (r *SQLAnnotationRepo) Update(item *annotations.Item) error {
	return inTransaction(func(sess *DBSession) error {
		var (
			isExist bool
			err     error
		)
		existing := new(annotations.Item)

		isExist, err = sess.Table("annotation").Where("id=? AND org_id=?", item.Id, item.OrgId).Get(existing)

		if err != nil {
			return err
		}
		if !isExist {
			return errors.New("annotation not found")
		}

		existing.Updated = timeNow().UnixNano() / int64(time.Millisecond)
		existing.Text = item.Text

		if item.Epoch != 0 {
			existing.Epoch = item.Epoch
		}
		if item.EpochEnd != 0 {
			existing.EpochEnd = item.EpochEnd
		}

		if err := validateTimeRange(existing); err != nil {
			return err
		}

		if item.Tags != nil {
			tags, err := EnsureTagsExist(sess, models.ParseTagPairs(item.Tags))
			if err != nil {
				return err
			}
			if _, err := sess.Exec("DELETE FROM annotation_tag WHERE annotation_id = ?", existing.Id); err != nil {
				return err
			}
			for _, tag := range tags {
				if _, err := sess.Exec("INSERT INTO annotation_tag (annotation_id, tag_id) VALUES(?,?)", existing.Id, tag.Id); err != nil {
					return err
				}
			}
		}

		existing.Tags = item.Tags

		_, err = sess.Table("annotation").ID(existing.Id).Cols("epoch", "text", "epoch_end", "updated", "tags").Update(existing)
		return err
	})
}

func (r *SQLAnnotationRepo) Find(query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`
		SELECT
			annotation.id,
			annotation.epoch as time,
			annotation.epoch_end as time_end,
			annotation.dashboard_id,
			annotation.panel_id,
			annotation.new_state,
			annotation.prev_state,
			annotation.alert_id,
			annotation.text,
			annotation.tags,
			annotation.data,
			annotation.created,
			annotation.updated,
			usr.email,
			usr.login,
			alert.name as alert_name
		FROM annotation
		LEFT OUTER JOIN ` + dialect.Quote("user") + ` as usr on usr.id = annotation.user_id
		LEFT OUTER JOIN alert on alert.id = annotation.alert_id
		INNER JOIN (
			SELECT a.id from annotation a
		`)

	sql.WriteString(`WHERE a.org_id = ?`)
	params = append(params, query.OrgId)

	if query.AnnotationId != 0 {
		// fmt.Print("annotation query")
		sql.WriteString(` AND a.id = ?`)
		params = append(params, query.AnnotationId)
	}

	if query.AlertId != 0 {
		sql.WriteString(` AND a.alert_id = ?`)
		params = append(params, query.AlertId)
	}

	if query.DashboardId != 0 {
		sql.WriteString(` AND a.dashboard_id = ?`)
		params = append(params, query.DashboardId)
	}

	if query.PanelId != 0 {
		sql.WriteString(` AND a.panel_id = ?`)
		params = append(params, query.PanelId)
	}

	if query.UserId != 0 {
		sql.WriteString(` AND a.user_id = ?`)
		params = append(params, query.UserId)
	}

	if query.From > 0 && query.To > 0 {
		sql.WriteString(` AND a.epoch <= ? AND a.epoch_end >= ?`)
		params = append(params, query.To, query.From)
	}

	if query.Type == "alert" {
		sql.WriteString(` AND a.alert_id > 0`)
	} else if query.Type == "annotation" {
		sql.WriteString(` AND a.alert_id = 0`)
	}

	if len(query.Tags) > 0 {
		keyValueFilters := []string{}

		tags := models.ParseTagPairs(query.Tags)
		for _, tag := range tags {
			if tag.Value == "" {
				keyValueFilters = append(keyValueFilters, "(tag."+dialect.Quote("key")+" = ?)")
				params = append(params, tag.Key)
			} else {
				keyValueFilters = append(keyValueFilters, "(tag."+dialect.Quote("key")+" = ? AND tag."+dialect.Quote("value")+" = ?)")
				params = append(params, tag.Key, tag.Value)
			}
		}

		if len(tags) > 0 {
			tagsSubQuery := fmt.Sprintf(`
        SELECT SUM(1) FROM annotation_tag at
          INNER JOIN tag on tag.id = at.tag_id
          WHERE at.annotation_id = a.id
            AND (
              %s
            )
      `, strings.Join(keyValueFilters, " OR "))

			if query.MatchAny {
				sql.WriteString(fmt.Sprintf(" AND (%s) > 0 ", tagsSubQuery))
			} else {
				sql.WriteString(fmt.Sprintf(" AND (%s) = %d ", tagsSubQuery, len(tags)))
			}
		}
	}

	if query.Limit == 0 {
		query.Limit = 100
	}

	// order of ORDER BY arguments match the order of a sql index for performance
	sql.WriteString(" ORDER BY a.org_id, a.epoch_end DESC, a.epoch DESC" + dialect.Limit(query.Limit) + " ) dt on dt.id = annotation.id")

	items := make([]*annotations.ItemDTO, 0)

	if err := x.SQL(sql.String(), params...).Find(&items); err != nil {
		return nil, err
	}

	return items, nil
}

func (r *SQLAnnotationRepo) Delete(params *annotations.DeleteParams) error {
	return inTransaction(func(sess *DBSession) error {
		var (
			sql         string
			annoTagSQL  string
			queryParams []interface{}
		)

		sqlog.Info("delete", "orgId", params.OrgId)
		if params.Id != 0 {
			annoTagSQL = "DELETE FROM annotation_tag WHERE annotation_id IN (SELECT id FROM annotation WHERE id = ? AND org_id = ?)"
			sql = "DELETE FROM annotation WHERE id = ? AND org_id = ?"
			queryParams = []interface{}{params.Id, params.OrgId}
		} else {
			annoTagSQL = "DELETE FROM annotation_tag WHERE annotation_id IN (SELECT id FROM annotation WHERE dashboard_id = ? AND panel_id = ? AND org_id = ?)"
			sql = "DELETE FROM annotation WHERE dashboard_id = ? AND panel_id = ? AND org_id = ?"
			queryParams = []interface{}{params.DashboardId, params.PanelId, params.OrgId}
		}

		sqlOrArgs := append([]interface{}{annoTagSQL}, queryParams...)

		if _, err := sess.Exec(sqlOrArgs...); err != nil {
			return err
		}

		sqlOrArgs = append([]interface{}{sql}, queryParams...)

		if _, err := sess.Exec(sqlOrArgs...); err != nil {
			return err
		}

		return nil
	})
}

func (r *SQLAnnotationRepo) FindTags(query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	if query.Limit == 0 {
		query.Limit = 100
	}

	var sql bytes.Buffer
	params := make([]interface{}, 0)
	tagKey := `tag.` + dialect.Quote("key")
	tagValue := `tag.` + dialect.Quote("value")

	sql.WriteString(`
		SELECT
			` + tagKey + `,
			` + tagValue + `,
			count(*) as count
		FROM tag
		INNER JOIN annotation_tag ON tag.id = annotation_tag.tag_id
`)

	sql.WriteString(`WHERE EXISTS(SELECT 1 FROM annotation WHERE annotation.id = annotation_tag.annotation_id AND annotation.org_id = ?)`)
	params = append(params, query.OrgID)

	sql.WriteString(` AND (` + tagKey + ` ` + dialect.LikeStr() + ` ? OR ` + tagValue + ` ` + dialect.LikeStr() + ` ?)`)
	params = append(params, `%`+query.Tag+`%`, `%`+query.Tag+`%`)

	sql.WriteString(` GROUP BY ` + tagKey + `,` + tagValue)
	sql.WriteString(` ORDER BY ` + tagKey + `,` + tagValue)
	sql.WriteString(` ` + dialect.Limit(query.Limit))

	var items []*annotations.Tag
	if err := x.SQL(sql.String(), params...).Find(&items); err != nil {
		return annotations.FindTagsResult{Tags: []*annotations.TagsDTO{}}, err
	}

	tags := make([]*annotations.TagsDTO, 0)
	for _, item := range items {
		tag := item.Key
		if len(item.Value) > 0 {
			tag = item.Key + ":" + item.Value
		}
		tags = append(tags, &annotations.TagsDTO{
			Tag:   tag,
			Count: item.Count,
		})
	}

	return annotations.FindTagsResult{Tags: tags}, nil
}
