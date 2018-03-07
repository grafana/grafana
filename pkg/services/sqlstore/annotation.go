package sqlstore

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/annotations"
)

type SqlAnnotationRepo struct {
}

func (r *SqlAnnotationRepo) Save(item *annotations.Item) error {
	return inTransaction(func(sess *DBSession) error {

		if _, err := sess.Table("annotation").Insert(item); err != nil {
			return err
		}

		return nil
	})
}

func (r *SqlAnnotationRepo) Update(item *annotations.Item) error {
	return inTransaction(func(sess *DBSession) error {

		if _, err := sess.Table("annotation").Id(item.Id).Update(item); err != nil {
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

	if len(query.NewState) > 0 {
		sql.WriteString(` AND new_state IN (?` + strings.Repeat(",?", len(query.NewState)-1) + ")")
		for _, v := range query.NewState {
			params = append(params, v)
		}
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

		sql := "DELETE FROM annotation WHERE dashboard_id = ? AND panel_id = ?"

		_, err := sess.Exec(sql, params.DashboardId, params.PanelId)
		if err != nil {
			return err
		}

		return nil
	})
}
