package api

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
)

type fakePluginManager struct {
	plugins.Manager

	plugins map[string]fakePlugin
}

type fakePlugin struct {
	pluginID string
	version  string
}

func (pm *fakePluginManager) Add(_ context.Context, pluginID, version string, _ plugins.CompatOpts) error {
	pm.plugins[pluginID] = fakePlugin{
		pluginID: pluginID,
		version:  version,
	}
	return nil
}

func (pm *fakePluginManager) Remove(_ context.Context, pluginID string) error {
	delete(pm.plugins, pluginID)
	return nil
}

type fakePluginStore struct {
	plugins.Store

	plugins map[string]plugins.PluginDTO
}

func (pr fakePluginStore) Plugin(_ context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := pr.plugins[pluginID]

	return p, exists
}

func (pr fakePluginStore) Plugins(_ context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	var result []plugins.PluginDTO
	if len(pluginTypes) == 0 {
		pluginTypes = plugins.PluginTypes
	}
	for _, v := range pr.plugins {
		for _, t := range pluginTypes {
			if v.Type == t {
				result = append(result, v)
			}
		}
	}

	return result
}

type fakeRendererManager struct {
	plugins.RendererManager
}

func (ps *fakeRendererManager) Renderer(_ context.Context) *plugins.Plugin {
	return nil
}

type fakePluginStaticRouteResolver struct {
	plugins.StaticRouteResolver

	routes []*plugins.StaticRoute
}

func (psrr *fakePluginStaticRouteResolver) Routes() []*plugins.StaticRoute {
	return psrr.routes
}

type fakePluginSettings struct {
	pluginsettings.Service

	plugins map[string]*pluginsettings.DTO
}

// GetPluginSettings returns all Plugin Settings for the provided Org
func (ps *fakePluginSettings) GetPluginSettings(ctx context.Context, args *pluginsettings.GetArgs) ([]*pluginsettings.DTO, error) {
	res := []*pluginsettings.DTO{}
	for _, dto := range ps.plugins {
		res = append(res, dto)
	}
	return res, nil
}

// GetPluginSettingByPluginID returns a Plugin Settings by Plugin ID
func (ps *fakePluginSettings) GetPluginSettingByPluginID(ctx context.Context, args *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
	if res, ok := ps.plugins[args.PluginID]; ok {
		return res, nil
	}
	return nil, models.ErrPluginSettingNotFound
}

// UpdatePluginSetting updates a Plugin Setting
func (ps *fakePluginSettings) UpdatePluginSetting(ctx context.Context, args *pluginsettings.UpdateArgs) error {
	var secureData map[string][]byte
	if args.SecureJSONData != nil {
		secureData := map[string][]byte{}
		for k, v := range args.SecureJSONData {
			secureData[k] = ([]byte)(v)
		}
	}
	// save
	ps.plugins[args.PluginID] = &pluginsettings.DTO{
		ID:             int64(len(ps.plugins)),
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
func (ps *fakePluginSettings) UpdatePluginSettingPluginVersion(ctx context.Context, args *pluginsettings.UpdatePluginVersionArgs) error {
	if res, ok := ps.plugins[args.PluginID]; ok {
		res.PluginVersion = args.PluginVersion
		return nil
	}
	return models.ErrPluginSettingNotFound
}

// DecryptedValues decrypts the encrypted secureJSONData of the provided plugin setting and
// returns the decrypted values.
func (ps *fakePluginSettings) DecryptedValues(dto *pluginsettings.DTO) map[string]string {
	// TODO: Implement
	return nil
}
