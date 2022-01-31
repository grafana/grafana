package navbarpreferences

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (n *NavbarPreferencesService) getNavbarPreferences(c context.Context, signedInUser *models.SignedInUser) ([]NavbarPreference, error) {
	err := n.SQLStore.WithDbSession(c, func(sess *sqlstore.DBSession) error {
    // builder

		builder := sqlstore.SQLBuilder{}
		builder.Write("SELECT * from nav_preferences")
		builder.Write("SELECT * from nav_preferences")
		if err := session.SQL(builder.GetSQLString(), builder.GetParams()...).Find(&libraryElements); err != nil {
			return err
		}

	  sess := session.SQL(sql, uid, orgID)
	  err := sess.Find(&elements)
		if len(libraryElements) == 0 {
			return ErrLibraryElementNotFound
		}

		return nil
  })

  if err != nil {
		return []NavbarPreference{}, err
	}

}
