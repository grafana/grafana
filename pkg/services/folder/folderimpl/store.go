package folderimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
)

type store interface {
	// Create creates a folder and returns the newly-created folder.
	Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error)

	// Delete deletes a folder from the folder store.
	Delete(ctx context.Context, uid string, orgID int64) error

	// Update updates the given folder's UID, Title, and Description.
	// Use Move to change a dashboard's parent ID.
	Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error)

	// Move changes the given folder's parent folder uid and applies any necessary permissions changes.
	Move(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error)

	// Get returns a folder.
	Get(ctx context.Context, cmd *folder.GetFolderCommand) (*folder.Folder, error)

	// GetParents returns an ordered list of parent folder of the given folder.
	GetParents(ctx context.Context, cmd *folder.GetParentsCommand) ([]*folder.Folder, error)

	// GetChildren returns the set of immediate children folders (depth=1) of the
	// given folder.
	GetChildren(ctx context.Context, cmd *folder.GetTreeCommand) ([]*folder.Folder, error)
}

type sqlStore struct {
	db  db.DB
	log log.Logger
	cfg *setting.Cfg
	fm  featuremgmt.FeatureManager
}

// sqlStore implements the store interface.
var _ store = (*sqlStore)(nil)

func ProvideStore(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureManager) *sqlStore {
	return &sqlStore{db: db, log: log.New("folder-store"), cfg: cfg, fm: features}
}

func (s *sqlStore) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	panic("not implemented")
}

func (ss *sqlStore) Delete(ctx context.Context, uid string, orgID int64) error {
	panic("not implemented")
}

func (ss *sqlStore) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	panic("not implemented")
}

func (ss *sqlStore) Move(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	panic("not implemented")
}

func (ss *sqlStore) Get(ctx context.Context, cmd *folder.GetFolderCommand) (*folder.Folder, error) {
	panic("not implemented")
}

func (ss *sqlStore) GetParents(ctx context.Context, cmd *folder.GetParentsCommand) ([]*folder.Folder, error) {
	panic("not implemented")
}

func (ss *sqlStore) GetChildren(ctx context.Context, cmd *folder.GetTreeCommand) ([]*folder.Folder, error) {
	panic("not implemented")
}
