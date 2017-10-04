package sqlstore

import (
	"bytes"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/annotations"
)

type SqlAnnotationRepo struct {
}

func (r *SqlAnnotationRepo) Save(item *annotations.Item) error {
	return inTransaction(func(sess *DBSession) error {

		if _, err := sess.Table("annotation").Insert(item); err != nil {
			return err
		}

		if item.Data != nil {
			tags := item.Data.Get("tags").MustStringArray()
			for _, tag := range tags {
				if _, err := sess.Exec("INSERT INTO annotation_tag (annotation_id, tag) VALUES(?,?)", item.Id, tag); err != nil {
					return err
				}
			}
		}

		return nil
	})
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
		existing.Title = item.Title
		existing.Text = item.Text
		existing.RegionId = item.RegionId

		if _, err := sess.Table("annotation").Id(existing.Id).Update(existing); err != nil {
			return err
		}

		return nil
	})
}

func (r *SqlAnnotationRepo) Find(query *annotations.ItemQuery) ([]*annotations.Item, error) {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT *
	from annotation
	`)

	sql.WriteString(`WHERE org_id = ?`)
	params = append(params, query.OrgId)

	if query.AlertId != 0 {
		sql.WriteString(` AND alert_id = ?`)
		params = append(params, query.AlertId)
	}

	if query.AlertId != 0 {
		sql.WriteString(` AND alert_id = ?`)
		params = append(params, query.AlertId)
	}

	if query.DashboardId != 0 {
		sql.WriteString(` AND dashboard_id = ?`)
		params = append(params, query.DashboardId)
	}

	if query.PanelId != 0 {
		sql.WriteString(` AND panel_id = ?`)
		params = append(params, query.PanelId)
	}

	if query.From > 0 && query.To > 0 {
		sql.WriteString(` AND epoch BETWEEN ? AND ?`)
		params = append(params, query.From, query.To)
	}

	if query.Type != "" {
		sql.WriteString(` AND type = ?`)
		params = append(params, string(query.Type))
	}

	if query.Limit == 0 {
		query.Limit = 10
	}

	sql.WriteString(fmt.Sprintf(" ORDER BY epoch DESC LIMIT %v", query.Limit))

	items := make([]*annotations.Item, 0)
	if err := x.Sql(sql.String(), params...).Find(&items); err != nil {
		return nil, err
	}

	return items, nil
}

func (r *SqlAnnotationRepo) Delete(params *annotations.DeleteParams) error {
	return inTransaction(func(sess *DBSession) error {
		var (
			err         error
			sql         string
			queryParams []interface{}
		)

		if params.RegionId != 0 {
			sql = "DELETE FROM annotation WHERE region_id = ?"
			queryParams = []interface{}{params.RegionId}
		} else if params.Id != 0 {
			sql = "DELETE FROM annotation WHERE id = ?"
			queryParams = []interface{}{params.Id}
		} else {
			sql = "DELETE FROM annotation WHERE dashboard_id = ? AND panel_id = ?"
			queryParams = []interface{}{params.DashboardId, params.PanelId}
		}

		_, err = sess.Exec(sql, queryParams...)
		if err != nil {
			return err
		}

		return nil
	})
}
