package folderimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
)

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

func (s *sqlStore) Delete(ctx context.Context, uid string, orgID int64) error {
	panic("not implemented")
}

func (s *sqlStore) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	panic("not implemented")
}

func (s *sqlStore) Move(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	panic("not implemented")
}

func (s *sqlStore) Get(ctx context.Context, cmd *folder.GetFolderQuery) (*folder.Folder, error) {
	panic("not implemented")
}

func (s *sqlStore) GetParents(ctx context.Context, cmd *folder.GetParentsQuery) ([]*folder.Folder, error) {
	panic("not implemented")
}

func (s *sqlStore) GetChildren(ctx context.Context, cmd *folder.GetTreeQuery) ([]*folder.Folder, error) {
	panic("not implemented")
}
