package librarypanels

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// AddLibraryPanel function adds a LibraryPanel
func (lps *LibraryPanelService) addLibraryPanel(cmd *addLibraryPanelCommand) error {
	return lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		libraryPanel := &LibraryPanel{
			OrgId:    cmd.OrgId,
			FolderId: cmd.FolderId,
			Title:    cmd.Title,
			Model:    cmd.Model,

			Created: time.Now(),
			Updated: time.Now(),

			CreatedBy: cmd.SignedInUser.UserId,
			UpdatedBy: cmd.SignedInUser.UserId,
		}

		if res, err := session.Query("SELECT 1 from library_panel WHERE org_id=? and folder_id=? and title=?", cmd.OrgId, cmd.FolderId, cmd.Title); err != nil {
			return err
		} else if len(res) == 1 {
			return errLibraryPanelAlreadyAdded
		}

		// TODO
		// check if user has rights

		if _, err := session.Insert(libraryPanel); err != nil {
			return err
		}

		cmd.Result = libraryPanel
		return nil
	})
}
