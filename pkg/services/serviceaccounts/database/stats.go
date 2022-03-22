package database

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (s *ServiceAccountsStoreImpl) GetUsageMetrics(ctx context.Context) (map[string]interface{}, error) {
	stats := map[string]interface{}{"stats.serviceaccounts.enabled.count": int64(1)}

	sb := &sqlstore.SQLBuilder{}
	dialect := s.sqlStore.Dialect
	sb.Write("SELECT ")
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("user") +
		` WHERE is_service_account = ` + dialect.BooleanStr(true) + `) AS serviceaccounts,`)
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("api_key") +
		` WHERE service_account_id IS NOT NULL ) AS serviceaccount_tokens`)

	type saStats struct {
		ServiceAccounts int64 `xorm:"serviceaccounts"`
		Tokens          int64 `xorm:"serviceaccount_tokens"`
	}

	var sqlStats saStats
	if err := s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.SQL(sb.GetSQLString(), sb.GetParams()...).Get(&sqlStats)
		return err
	}); err != nil {
		return nil, err
	}

	stats["stats.serviceaccounts.count"] = sqlStats.ServiceAccounts
	stats["stats.serviceaccounts.tokens.count"] = sqlStats.Tokens

	return stats, nil
}
