package database

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	ExporterName              = "grafana"
	metricsCollectionInterval = time.Minute * 30
)

var (
	// MStatTotalServiceAccounts is a metric gauge for total number of service accounts
	MStatTotalServiceAccounts prometheus.Gauge

	// MStatTotalServiceAccountTokens is a metric gauge for total number of service account tokens
	MStatTotalServiceAccountTokens prometheus.Gauge

	once        sync.Once
	Initialised bool = false
)

func InitMetrics() {
	once.Do(func() {
		MStatTotalServiceAccounts = prometheus.NewGauge(prometheus.GaugeOpts{
			Name:      "stat_total_service_accounts",
			Help:      "total amount of service accounts",
			Namespace: ExporterName,
		})

		MStatTotalServiceAccountTokens = prometheus.NewGauge(prometheus.GaugeOpts{
			Name:      "stat_total_service_account_tokens",
			Help:      "total amount of service account tokens",
			Namespace: ExporterName,
		})

		prometheus.MustRegister(
			MStatTotalServiceAccounts,
			MStatTotalServiceAccountTokens,
		)
	})
}

func (s *ServiceAccountsStoreImpl) RunMetricsCollection(ctx context.Context) error {
	if _, err := s.GetUsageMetrics(ctx); err != nil {
		s.log.Warn("Failed to get usage metrics", "error", err.Error())
	}
	updateStatsTicker := time.NewTicker(metricsCollectionInterval)
	defer updateStatsTicker.Stop()

	for {
		select {
		case <-updateStatsTicker.C:
			if _, err := s.GetUsageMetrics(ctx); err != nil {
				s.log.Warn("Failed to get usage metrics", "error", err.Error())
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

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

	MStatTotalServiceAccountTokens.Set(float64(sqlStats.Tokens))
	MStatTotalServiceAccounts.Set(float64(sqlStats.ServiceAccounts))

	return stats, nil
}
