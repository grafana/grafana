package database

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

func (s *ServiceAccountsStoreImpl) GetUsageMetrics(ctx context.Context) (*serviceaccounts.Stats, error) {
	dialect := s.sqlStore.GetDialect()

	sb := &db.SQLBuilder{}
	sb.Write("SELECT ")
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("user") + ` ` +
		`WHERE is_service_account = ` + dialect.BooleanStr(true) + `) AS serviceaccounts,`)
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("api_key") +
		`WHERE service_account_id IS NOT NULL ) AS serviceaccount_tokens,`)
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("org_user") + ` AS ou ` +
		`JOIN ` + dialect.Quote("user") + ` AS u ON u.id = ou.user_id ` +
		`WHERE u.is_disabled = ` + dialect.BooleanStr(false) + ` ` +
		`AND u.is_service_account = ` + dialect.BooleanStr(true) + ` ` +
		`AND ou.role=?) AS serviceaccounts_with_no_role`)
	sb.AddParams("None")

	var sqlStats serviceaccounts.Stats
	if err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.SQL(sb.GetSQLString(), sb.GetParams()...).Get(&sqlStats)
		return err
	}); err != nil {
		return nil, err
	}

	cfg := s.settingsProvider.Get()
	sqlStats.ForcedExpiryEnabled = cfg.SATokenExpirationDayLimit != 0

	return &sqlStats, nil
}
