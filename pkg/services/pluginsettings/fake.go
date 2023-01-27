package pluginsettings

import (
	"context"
	"time"
)

type FakePluginSettings struct {
	Service

	Plugins map[string]*DTO
}

// GetPluginSettings returns all Plugin Settings for the provided Org
func (ps *FakePluginSettings) GetPluginSettings(_ context.Context, _ *GetArgs) ([]*InfoDTO, error) {
	res := []*InfoDTO{}
	for _, dto := range ps.Plugins {
		res = append(res, &InfoDTO{
			PluginID:      dto.PluginID,
			OrgID:         dto.OrgID,
			Enabled:       dto.Enabled,
			Pinned:        dto.Pinned,
			PluginVersion: dto.PluginVersion,
		})
	}
	return res, nil
}

// GetPluginSettingByPluginID returns a Plugin Settings by Plugin ID
func (ps *FakePluginSettings) GetPluginSettingByPluginID(ctx context.Context, args *GetByPluginIDArgs) (*DTO, error) {
	if res, ok := ps.Plugins[args.PluginID]; ok {
		return res, nil
	}
	return nil, ErrPluginSettingNotFound
}

// UpdatePluginSetting updates a Plugin Setting
func (ps *FakePluginSettings) UpdatePluginSetting(ctx context.Context, args *UpdateArgs) error {
	var secureData map[string][]byte
	if args.SecureJSONData != nil {
		secureData := map[string][]byte{}
		for k, v := range args.SecureJSONData {
			secureData[k] = ([]byte)(v)
		}
	}
	// save
	ps.Plugins[args.PluginID] = &DTO{
		ID:             int64(len(ps.Plugins)),
		OrgID:          args.OrgID,
		PluginID:       args.PluginID,
		PluginVersion:  args.PluginVersion,
		JSONData:       args.JSONData,
		SecureJSONData: secureData,
		Enabled:        args.Enabled,
		Pinned:         args.Pinned,
		Updated:        time.Now(),
	}
	return nil
}

// UpdatePluginSettingPluginVersion updates a Plugin Setting's plugin version
func (ps *FakePluginSettings) UpdatePluginSettingPluginVersion(ctx context.Context, args *UpdatePluginVersionArgs) error {
	if res, ok := ps.Plugins[args.PluginID]; ok {
		res.PluginVersion = args.PluginVersion
		return nil
	}
	return ErrPluginSettingNotFound
}

// DecryptedValues decrypts the encrypted secureJSONData of the provided plugin setting and
// returns the decrypted values.
func (ps *FakePluginSettings) DecryptedValues(dto *DTO) map[string]string {
	// TODO: Implement
	return nil
}
