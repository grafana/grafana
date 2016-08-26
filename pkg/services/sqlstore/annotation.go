package sqlstore

import (
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
