package database

import (
	"context"

	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (s *ServiceAccountsStoreImpl) GetUsageMetrics(ctx context.Context) (*serviceaccounts.Stats, error) {
	dialect := s.sqlStore.Dialect

	sb := &sqlstore.SQLBuilder{}
	sb.Write("SELECT ")
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("user") +
		` WHERE is_service_account = ` + dialect.BooleanStr(true) + `) AS serviceaccounts,`)
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("api_key") +
		` WHERE service_account_id IS NOT NULL ) AS serviceaccount_tokens`)

	var sqlStats serviceaccounts.Stats
	if err := s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.SQL(sb.GetSQLString(), sb.GetParams()...).Get(&sqlStats)
		return err
	}); err != nil {
		return nil, err
	}

	return &sqlStats, nil
}
