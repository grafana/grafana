package sqlstore

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) HasMigratedServiceAccounts(ctx context.Context, orgID int64) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		// Try and find the user by login first.
		// It's not sufficient to assume that a LoginOrEmail with an "@" is an email.
		org := &models.Org{Id: orgID}
		has, err := sess.Get(org)
		if err != nil {
			return err
		}
		if !has {
			return errors.New("org not found")
		}
		hasMigratedServiceAccounts := 0
		results, err := sess.Query(&hasMigratedServiceAccounts, `SELECT count(*) FROM migration_log WHERE sql = ?`, orgID)
		if err != nil {
			return err
		}
		if len(results) != 1 {
			return errors.New("invalid result set")
		}
		return nil
	})
}
