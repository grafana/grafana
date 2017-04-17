package sqlstore

import (
	"github.com/grafana/grafana/pkg/services/category"
)

type SqlCategoryRepo struct {
}

func (r *SqlCategoryRepo) Save(item *category.Item) error {
	return nil
}

func (r *SqlCategoryRepo) Update(item *category.Item) error {
	return nil
}

func (r *SqlCategoryRepo) Delete(params *category.DeleteParams) error {
	return nil
}

func (r *SqlCategoryRepo) Find(params *category.FindParams) ([]*category.Item, error) {
	return nil, nil
}
