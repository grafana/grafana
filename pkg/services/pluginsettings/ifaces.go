package pluginsettings

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	GetPluginSettings(ctx context.Context, orgID int64) ([]*models.PluginSettingInfoDTO, error)
	GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error
	UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error
	UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error
}
