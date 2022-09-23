package plugins

import "context"

type FakePluginStore struct {
	Store

	PluginMap map[string]PluginDTO
}

func (pr FakePluginStore) Plugin(_ context.Context, pluginID string) (PluginDTO, bool) {
	p, exists := pr.PluginMap[pluginID]

	return p, exists
}

func (pr FakePluginStore) Plugins(_ context.Context, pluginTypes ...Type) []PluginDTO {
	var result []PluginDTO
	if len(pluginTypes) == 0 {
		pluginTypes = PluginTypes
	}
	for _, v := range pr.PluginMap {
		for _, t := range pluginTypes {
			if v.Type == t {
				result = append(result, v)
			}
		}
	}

	return result
}
