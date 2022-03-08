package pluginsettings

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	// GetPluginSettings returns all Plugin Settings for the provided Org
	GetPluginSettings(ctx context.Context, orgID int64) ([]*models.PluginSettingInfoDTO, error)
	// GetPluginSettingById returns a Plugin Settings by Plugin ID
	GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error
	// UpdatePluginSetting updates a Plugin Setting
	UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error
	// UpdatePluginSettingVersion updates a Plugin Setting's plugin version
	UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error
	// DecryptedValues decrypts the encrypted secureJSONData of the provided plugin setting and
	// returns the decrypted values.
	DecryptedValues(ps *models.PluginSetting) map[string]string
}
