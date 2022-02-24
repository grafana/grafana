package database

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (s *ServiceAccountsStoreImpl) DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error {
	rawSQL := "DELETE FROM api_key WHERE id=? and org_id=? and service_account_id=?"

	return s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		result, err := sess.Exec(rawSQL, tokenID, orgID, serviceAccountID)
		if err != nil {
			return err
		}
		n, err := result.RowsAffected()
		if err != nil {
			return err
		} else if n == 0 {
			return models.ErrApiKeyNotFound
		}
		return nil
	})
}
