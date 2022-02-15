package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

// GetDBHealthQuery executes a query to check
// the availability of the database.
func (ss *SQLStore) GetDBHealthQuery(ctx context.Context, query *models.GetDBHealthQuery) error {
	return withDbSession(ctx, x, func(session *DBSession) error {
		_, err := session.Exec("SELECT 1")
		return err
	})
}
