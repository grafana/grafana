package database

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type loginStats struct {
	DuplicateUserEntries int `xorm:"duplicate_user_entries"`
}

func (s *AuthInfoStore) GetLoginStats(ctx context.Context) (loginStats, error) {
	var stats loginStats
	outerErr := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		rawSQL := `SELECT COUNT(*) as duplicate_user_entries FROM (` + s.duplicateUserEntriesSQL(ctx) + `)`
		_, err := dbSession.SQL(rawSQL).Get(&stats)
		return err
	})
	if outerErr != nil {
		return stats, outerErr
	}
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
	return m, nil
}

func (s *AuthInfoStore) duplicateUserEntriesSQL(ctx context.Context) string {
	userDialect := db.DB.GetDialect(s.sqlStore).Quote("user")
	// this query counts how many users have the same login or email.
	// which might be confusing, but gives a good indication
	// we want this query to not require too much cpu
	sqlQuery := `SELECT
		(SELECT login from ` + userDialect + ` WHERE (LOWER(login) = LOWER(u.login)) AND (login != u.login)) AS dup_login,
		(SELECT email from ` + userDialect + ` WHERE (LOWER(email) = LOWER(u.email)) AND (email != u.email)) AS dup_email
	FROM ` + userDialect + ` AS u
	WHERE (dup_login IS NOT NULL OR dup_email IS NOT NULL)
	`
	return sqlQuery
}
