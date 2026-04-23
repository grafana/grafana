package openapi

import (
	"context"
	"fmt"
	"io/fs"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
)

type PluginInfo struct {
	JSONData plugins.JSONData

	// apiVersion -> schema (currently only v0alpha1)
	Schemas map[string]*pluginschema.PluginSchema
}

func LoadPlugins(ctx context.Context, pluginSources sources.Registry, filter func(plugins.JSONData) bool, withSchemas bool) ([]PluginInfo, error) {
	var pluginInfo []PluginInfo

	// It's possible that the same plugin will be found in different sources.
	// Registering the same plugin twice in the API is Probably A Bad Thing,
	// so this map keeps track of uniques, so we can skip duplicates.
	var uniquePlugins = map[string]bool{}

	for _, pluginSource := range pluginSources.List(ctx) {
		res, err := pluginSource.Discover(ctx)
		if err != nil {
			return nil, err
		}
		for _, p := range res {
			if filter(p.Primary.JSONData) {
				if _, found := uniquePlugins[p.Primary.JSONData.ID]; found {
					backend.Logger.Info("Found duplicate plugin %s when registering API groups.", p.Primary.JSONData.ID)
					continue
				}
				info, err := loadInfo(p.Primary.FS, p.Primary.JSONData, withSchemas)
				if err != nil {
					return nil, err
				}
				uniquePlugins[info.JSONData.ID] = true
				pluginInfo = append(pluginInfo, info)
			}

			for _, child := range p.Children {
				if filter(child.JSONData) {
					if _, found := uniquePlugins[child.JSONData.ID]; found {
						backend.Logger.Info("Found duplicate plugin %s when registering API groups.", child.JSONData.ID)
						continue
					}

					info, err := loadInfo(child.FS, child.JSONData, withSchemas)
					if err != nil {
						return nil, err
					}
					uniquePlugins[info.JSONData.ID] = true
					pluginInfo = append(pluginInfo, info)
				}
			}
		}
	}
	return pluginInfo, nil
}

func loadInfo(rootfs fs.FS, jsondata plugins.JSONData, withSchemas bool) (PluginInfo, error) {
	info := PluginInfo{
		JSONData: jsondata,
	}
	if !withSchemas {
		return info, nil
	}

	fss, err := fs.Sub(rootfs, "schema")
	if err != nil {
		return PluginInfo{}, fmt.Errorf("error accessing plugin fs %s: %w", jsondata.ID, err)
	}

	p := pluginschema.NewSchemaProvider(fss)
	schema, err := p.Get("v0alpha1")
	if err != nil {
		return PluginInfo{}, fmt.Errorf("error loading schema %s: %w", jsondata.ID, err)
	}
	info.Schemas = map[string]*pluginschema.PluginSchema{
		"v0alpha1": schema,
	}
	return info, nil
}
