package navbarpreferences

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (n *NavbarPreferencesService) getNavbarPreferences(c context.Context, signedInUser *models.SignedInUser) ([]NavbarPreferenceDTO, error) {
	navbarPreferences := make([]NavbarPreferenceDTO, 0)
	err := n.SQLStore.WithDbSession(c, func(sess *sqlstore.DBSession) error {
		// builder
		builder := sqlstore.SQLBuilder{}
		builder.Write("SELECT * from navbar_preference")
		builder.Write(` WHERE org_id=? AND user_id=?`, signedInUser.OrgId, signedInUser.UserId)
		if err := sess.SQL(builder.GetSQLString(), builder.GetParams()...).Find(&navbarPreferences); err != nil {
			return err
		}

		// TODO probably remove this
		if len(navbarPreferences) == 0 {
			fmt.Println("Nothing found!")
		}

		return nil
	})

	if err != nil {
		return []NavbarPreferenceDTO{}, err
	}

	return navbarPreferences, nil
}

func (n *NavbarPreferencesService) createNavbarPreference(c context.Context, signedInUser *models.SignedInUser, cmd CreateNavbarPreferenceCommand) (NavbarPreferenceDTO, error) {
	preference := NavbarPreference{
		OrgID:          signedInUser.OrgId,
		UserID:         signedInUser.UserId,
		NavItemID:      cmd.NavItemID,
		HideFromNavbar: cmd.HideFromNavbar,
		// TODO probably need to use this dialect object
		// HideFromNavbar: n.SQLStore.Dialect.BooleanStr(cmd.HideFromNavbar),
	}

	err := n.SQLStore.WithDbSession(c, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Insert(&preference); err != nil {
			return err
		}
		return nil
	})

	preferenceDTO := NavbarPreferenceDTO{
		ID:             preference.ID,
		OrgID:          preference.OrgID,
		UserID:         preference.UserID,
		NavItemID:      preference.NavItemID,
		HideFromNavbar: preference.HideFromNavbar,
	}

	return preferenceDTO, err
}
