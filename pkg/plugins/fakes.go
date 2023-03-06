package plugins

import (
	"context"
)

type FakePluginStore struct {
	Store

	PluginList []PluginDTO
}

func (pr FakePluginStore) Plugin(_ context.Context, pluginID string) (PluginDTO, bool) {
	for _, v := range pr.PluginList {
		if v.ID == pluginID {
			return v, true
		}
	}

	return PluginDTO{}, false
}

func (pr FakePluginStore) Plugins(_ context.Context, pluginTypes ...Type) []PluginDTO {
	var result []PluginDTO
	if len(pluginTypes) == 0 {
		pluginTypes = PluginTypes
	}

	for _, v := range pr.PluginList {
		for _, t := range pluginTypes {
			if v.Type == t {
				result = append(result, v)
			}
		}
	}

	return result
}
