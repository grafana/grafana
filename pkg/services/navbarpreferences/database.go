package navbarpreferences

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (n *NavbarPreferencesService) getNavbarPreferences(c context.Context, signedInUser *models.SignedInUser) ([]NavbarPreference, error) {
	err := n.SQLStore.WithDbSession(c, func(sess *sqlstore.DBSession) error {
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
