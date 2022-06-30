package database

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (s *ServiceAccountsStoreImpl) GetUsageMetrics(ctx context.Context) (map[string]interface{}, error) {
	stats := map[string]interface{}{}

	sb := &sqlstore.SQLBuilder{}
	dialect := s.sqlStore.Dialect
	sb.Write("SELECT ")
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("user") +
		` WHERE is_service_account = ` + dialect.BooleanStr(true) + `) AS serviceaccounts,`)
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("api_key") +
		` WHERE service_account_id IS NOT NULL ) AS serviceaccount_tokens,`)
	// Add count to how many service accounts are in teams
	sb.Write(`(SELECT COUNT(*) FROM team_member
	JOIN ` + dialect.Quote("user") + ` on team_member.user_id=` + dialect.Quote("user") + `.id
	WHERE ` + dialect.Quote("user") + `.is_service_account=` + dialect.BooleanStr(true) + ` ) as serviceaccounts_in_teams`)

	type saStats struct {
		ServiceAccounts int64 `xorm:"serviceaccounts"`
		Tokens          int64 `xorm:"serviceaccount_tokens"`
		InTeams         int64 `xorm:"serviceaccounts_in_teams"`
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
	stats["stats.serviceaccounts.in_teams.count"] = sqlStats.InTeams

	return stats, nil
}
