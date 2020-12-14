package teamgroupsync

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
)

type TeamSync interface {
	SyncTeams(user *models.User, externalUser *models.ExternalUserInfo) error
}

type TeamSyncService struct{}

func (t *TeamSyncService) SyncTeams(user *models.User, externalUser *models.ExternalUserInfo) error {
	return nil
}

func (t *TeamSyncService) Init() error {
	return nil
}

func init() {
	registry.RegisterService(&TeamSyncService{})
}
