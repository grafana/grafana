package database

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/prometheus/client_golang/prometheus"
)

type LoginStats struct {
	DuplicateUserEntries int `xorm:"duplicate_user_entries"`
	MixedCasedUsers      int `xorm:"mixed_cased_users"`
}

const (
	ExporterName              = "grafana"
	metricsCollectionInterval = time.Second * 60 * 4 // every 4 hours, indication of duplicate users
)

var (
	// MStatDuplicateUserEntries is a indication metric gauge for number of users with duplicate emails or logins
	MStatDuplicateUserEntries prometheus.Gauge

	// MStatHasDuplicateEntries is a metric for if there is duplicate users
	MStatHasDuplicateEntries prometheus.Gauge

	// MStatMixedCasedUsers is a metric for if there is duplicate users
	MStatMixedCasedUsers prometheus.Gauge

	once        sync.Once
	Initialised bool = false
)

func InitMetrics() {
	once.Do(func() {
		MStatDuplicateUserEntries = prometheus.NewGauge(prometheus.GaugeOpts{
			Name:      "stat_users_total_duplicate_user_entries",
			Help:      "total number of duplicate user entries by email or login",
			Namespace: ExporterName,
		})

		MStatHasDuplicateEntries = prometheus.NewGauge(prometheus.GaugeOpts{
			Name:      "stat_users_has_duplicate_user_entries",
			Help:      "instance has duplicate user entries by email or login",
			Namespace: ExporterName,
		})

		MStatMixedCasedUsers = prometheus.NewGauge(prometheus.GaugeOpts{
			Name:      "stat_users_total_mixed_cased_users",
			Help:      "total number of users with upper and lower case logins or emails",
			Namespace: ExporterName,
		})

		prometheus.MustRegister(
			MStatDuplicateUserEntries,
			MStatHasDuplicateEntries,
			MStatMixedCasedUsers,
		)
	})
}

func (s *AuthInfoStore) RunMetricsCollection(ctx context.Context) error {
	if _, err := s.GetLoginStats(ctx); err != nil {
		s.logger.Warn("Failed to get authinfo metrics", "error", err.Error())
	}
	updateStatsTicker := time.NewTicker(metricsCollectionInterval)
	defer updateStatsTicker.Stop()

	for {
		select {
		case <-updateStatsTicker.C:
			if _, err := s.GetLoginStats(ctx); err != nil {
				s.logger.Warn("Failed to get authinfo metrics", "error", err.Error())
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *AuthInfoStore) GetLoginStats(ctx context.Context) (LoginStats, error) {
	var stats LoginStats
	outerErr := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		rawSQL := `SELECT
		(SELECT COUNT(*) FROM (` + s.duplicateUserEntriesSQL(ctx) + `) AS d WHERE (d.dup_login IS NOT NULL OR d.dup_email IS NOT NULL)) as duplicate_user_entries,
		(SELECT COUNT(*) FROM (` + s.mixedCasedUsers(ctx) + `) AS mcu) AS mixed_cased_users
		`
		_, err := dbSession.SQL(rawSQL).Get(&stats)
		return err
	})
	if outerErr != nil {
		return stats, outerErr
	}

	// set prometheus metrics stats
	MStatDuplicateUserEntries.Set(float64(stats.DuplicateUserEntries))
	if stats.DuplicateUserEntries == 0 {
		MStatHasDuplicateEntries.Set(float64(0))
	} else {
		MStatHasDuplicateEntries.Set(float64(1))
	}

	MStatMixedCasedUsers.Set(float64(stats.MixedCasedUsers))
	return stats, nil
}

func (s *AuthInfoStore) CollectLoginStats(ctx context.Context) (map[string]interface{}, error) {
	m := map[string]interface{}{}

	loginStats, err := s.GetLoginStats(ctx)
	if err != nil {
		s.logger.Error("Failed to get login stats", "error", err)
		return nil, err
	}

	m["stats.users.duplicate_user_entries"] = loginStats.DuplicateUserEntries
	if loginStats.DuplicateUserEntries > 0 {
		m["stats.users.has_duplicate_user_entries"] = 1
	} else {
		m["stats.users.has_duplicate_user_entries"] = 0
	}

	m["stats.users.mixed_cased_users"] = loginStats.MixedCasedUsers

	return m, nil
}

func (s *AuthInfoStore) duplicateUserEntriesSQL(ctx context.Context) string {
	userDialect := s.sqlStore.GetDialect().Quote("user")
	// this query counts how many users have the same login or email.
	// which might be confusing, but gives a good indication
	// we want this query to not require too much cpu
	sqlQuery := `SELECT
		(SELECT login from ` + userDialect + ` WHERE (LOWER(login) = LOWER(u.login)) AND (login != u.login)) AS dup_login,
		(SELECT email from ` + userDialect + ` WHERE (LOWER(email) = LOWER(u.email)) AND (email != u.email)) AS dup_email
	FROM ` + userDialect + ` AS u`
	return sqlQuery
}

func (s *AuthInfoStore) mixedCasedUsers(ctx context.Context) string {
	userDialect := db.DB.GetDialect(s.sqlStore).Quote("user")
	// this query counts how many users have upper case and lower case login or emails.
	// why
	// users login via IDP or service providers get upper cased domains at times :shrug:
	sqlQuery := `SELECT login, email FROM ` + userDialect + ` WHERE (LOWER(login) != login OR lower(email) != email)`
	return sqlQuery
}
