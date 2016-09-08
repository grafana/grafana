package sqlstore

import (
	"bytes"
	"fmt"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/services/annotations"
)

type SqlAnnotationRepo struct {
}

func (r *SqlAnnotationRepo) Save(item *annotations.Item) error {
	return inTransaction(func(sess *xorm.Session) error {

		if _, err := sess.Table("annotation").Insert(item); err != nil {
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

	sql.WriteString(` AND epoch BETWEEN ? AND ?`)
	params = append(params, query.From, query.To)

	if query.Type != "" {
		sql.WriteString(` AND type = ?`)
		params = append(params, string(query.Type))
	}

	if query.Limit == 0 {
		query.Limit = 10
	}

	sql.WriteString(fmt.Sprintf("ORDER BY epoch DESC LIMIT %v", query.Limit))

	items := make([]*annotations.Item, 0)
	if err := x.Sql(sql.String(), params...).Find(&items); err != nil {
		return nil, err
	}

	return items, nil
}
