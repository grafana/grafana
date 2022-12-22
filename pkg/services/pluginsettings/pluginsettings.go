package pluginsettings

import (
	"context"
)

type Service interface {
	// GetPluginSettings returns all Plugin Settings for the provided Org
	GetPluginSettings(ctx context.Context, args *GetArgs) ([]*InfoDTO, error)
	// GetPluginSettingByPluginID returns a Plugin Settings by Plugin ID
	GetPluginSettingByPluginID(ctx context.Context, args *GetByPluginIDArgs) (*DTO, error)
	// UpdatePluginSetting updates a Plugin Setting
	UpdatePluginSetting(ctx context.Context, args *UpdateArgs) error
	// UpdatePluginSettingPluginVersion updates a Plugin Setting's plugin version
	UpdatePluginSettingPluginVersion(ctx context.Context, args *UpdatePluginVersionArgs) error
	// DecryptedValues decrypts the encrypted secureJSONData of the provided plugin setting and
	// returns the decrypted values.
	DecryptedValues(ps *DTO) map[string]string
}
