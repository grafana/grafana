package folderimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
)

type NestedFolderSvcImpl struct {
	store db.DB
	cfg   *setting.Cfg
	log   log.Logger
	feats featuremgmt.FeatureManager
}

var _ folder.NestedFolderService = (*NestedFolderSvcImpl)(nil)

func ProvideNestedService(store db.DB, cfg *setting.Cfg, feats featuremgmt.FeatureManager) *NestedFolderSvcImpl {
	return &NestedFolderSvcImpl{
		store: store,
		cfg:   cfg,
		feats: feats,
		log:   log.New("folder-service"),
	}
}

func (s *NestedFolderSvcImpl) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	panic("not implemented")
	return nil, nil
}

func (s *NestedFolderSvcImpl) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	panic("not implemented")
	return nil, nil
}

func (s *NestedFolderSvcImpl) Move(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	panic("not implemented")
	return nil, nil
}

func (s *NestedFolderSvcImpl) Delete(ctx context.Context, cmd *folder.DeleteFolderCommand) (*folder.Folder, error) {
	panic("not implemented")
	return nil, nil
}

func (s *NestedFolderSvcImpl) Get(ctx context.Context, cmd *folder.GetFolderCommand) (*folder.Folder, error) {
	panic("not implemented")
	return nil, nil
}

func (s *NestedFolderSvcImpl) GetParents(ctx context.Context, orgID int64, folderUID string) ([]*folder.Folder, error) {
	panic("not implemented")
	return nil, nil
}

func (s *NestedFolderSvcImpl) GetTree(ctx context.Context, orgID int64, folderUID string, depth int64) (map[string][]*folder.Folder, error) {
	panic("not implemented")
	return nil, nil
}
