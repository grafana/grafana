package navbarpreferences

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) addNavbarPreferencesQueryAndCommandHandlers() {
	bus.AddHandler("sql", ss.GetNavbarPreferences)
}

func (ss *SQLStore) GetNavbarPreferences(ctx context.Context, query *models.GetNavbarPreferencesQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		var prefs []models.NavbarPreferences
		exists, err := sess.Where("org_id=? AND user_id=?", query.OrgId, query.UserId).Get(&prefs)

		if err != nil {
			return err
		}

		if exists {
			query.Result = &prefs
		} else {
			query.Result = new([]models.NavbarPreferences)
		}

		return nil
	})
}
