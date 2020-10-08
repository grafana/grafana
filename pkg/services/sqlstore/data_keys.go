package sqlstore

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"xorm.io/xorm"
)

func (ss *SqlStore) GetDataKey(name string) (*models.DataKey, error) {
	return getDataKey(name, ss.engine)
}

func getDataKey(name string, engine *xorm.Engine) (*models.DataKey, error) {
	dataKey := &models.DataKey{Name: name}
	exists, err := engine.Get(dataKey)

	if err != nil {
		sqlog.Error("Failed getting data key", "err", err, "name", name)
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}
	if !exists {
		return nil, models.ErrDataKeyNotFound
	}

	return dataKey, nil
}
