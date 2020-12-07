package librarypanels

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type LibraryPanelRepository interface {
	addLibraryPanel(cmd *addLibraryPanelCommand) error
}

type SQLLibraryPanelRepository struct {
	cfg      *setting.Cfg
	sqlStore *sqlstore.SQLStore
}

func NewRepository(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore) LibraryPanelRepository {
	repository := SQLLibraryPanelRepository{
		cfg:      cfg,
		sqlStore: sqlStore,
	}

	return &repository
}

// addLibraryPanel function adds a LibraryPanel
func (repo *SQLLibraryPanelRepository) addLibraryPanel(cmd *addLibraryPanelCommand) error {
	if !repo.cfg.IsPanelLibraryEnabled() {
		return nil
	}

	return repo.sqlStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
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
