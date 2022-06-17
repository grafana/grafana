package database

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

var once sync.Once

type loginStats struct {
	DuplicateUserEntries int `xorm:"duplicate_user_entries"`
}

func (s *AuthInfoStore) GetLoginStats(ctx context.Context) (stats loginStats, err error) {
	outerErr := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		rawSQL := `SELECT COUNT(*) FROM (` + s.duplicateUserEntriesSQL(ctx) + `) AS duplicate_user_entries`
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
	return m, nil
}

func (s *AuthInfoStore) duplicateUserEntriesSQL(ctx context.Context) string {
	userDialect := s.sqlStore.GetDialect().Quote("user")
	sqlQuery := `SELECT
		(SELECT login from ` + userDialect + ` WHERE (LOWER(login) = LOWER(u.login)) AND (login != u.login)) AS dup_login,
		(SELECT email from ` + userDialect + ` WHERE (LOWER(email) = LOWER(u.email)) AND (email != u.email)) AS dup_email
	FROM ` + userDialect + ` AS u
	WHERE (dup_login IS NOT NULL OR dup_email IS NOT NULL)
	`
	return sqlQuery
}
