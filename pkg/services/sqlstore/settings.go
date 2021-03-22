package sqlstore

import (
	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) GetSettings() ([]models.Setting, error) {
	var settings = make([]models.Setting, 0)

	err := inTransaction(func(sess *DBSession) error {
		return x.Find(&settings)
	})

	return settings, err
}
