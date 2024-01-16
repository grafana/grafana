package pluginstore

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type FakePluginStore struct {
	PluginList []Plugin
}

func (pr *FakePluginStore) Plugin(_ context.Context, pluginID string) (Plugin, bool) {
	for _, v := range pr.PluginList {
		if v.ID == pluginID {
			return v, true
		}
	}

	return Plugin{}, false
}

func (pr *FakePluginStore) Plugins(_ context.Context, pluginTypes ...plugins.Type) []Plugin {
	var result []Plugin
	if len(pluginTypes) == 0 {
		pluginTypes = plugins.PluginTypes
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
