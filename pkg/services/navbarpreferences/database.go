package navbarpreferences

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (n *NavbarPreferencesService) getNavbarPreferences(c context.Context, signedInUser *models.SignedInUser) ([]NavbarPreference, error) {
	navbarPreferences := make([]NavbarPreference, 0)
	err := n.SQLStore.WithDbSession(c, func(sess *sqlstore.DBSession) error {
		// builder
		builder := sqlstore.SQLBuilder{}
		builder.Write("SELECT * from navbar_preferences")
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
		return []NavbarPreference{}, err
	}

	return navbarPreferences, nil
}

func (n *NavbarPreferencesService) createNavbarPreference(c context.Context, signedInUser *models.SignedInUser, cmd CreateNavbarPreferenceCommand) (NavbarPreference, error) {
	preference := NavbarPreference{
		OrgID:          signedInUser.OrgId,
		UserID:         signedInUser.UserId,
		NavItemID:      cmd.NavItemID,
		HideFromNavbar: cmd.HideFromNavbar,
	}

	err := n.SQLStore.WithDbSession(c, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Insert(&preference); err != nil {
			return err
		}
		return nil
	})

	return preference, err
}
