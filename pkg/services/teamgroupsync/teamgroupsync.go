package teamgroupsync

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
)

type TeamSync interface {
	SyncTeams(ctx context.Context, user *models.User, externalUser *models.ExternalUserInfo) error
}

type TeamSyncService struct{}

func (t *TeamSyncService) SyncTeams(ctx context.Context, user *models.User, externalUser *models.ExternalUserInfo) error {
	return nil
}

func (t *TeamSyncService) Init() error {
	return nil
}

func init() {
	registry.RegisterService(&TeamSyncService{})
}
