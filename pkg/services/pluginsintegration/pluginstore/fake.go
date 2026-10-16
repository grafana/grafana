package pluginstore

import (
	"context"
	"slices"

	"github.com/grafana/grafana/pkg/plugins"
)

type FakePluginStore struct {
	PluginList []Plugin
}

func NewFakePluginStore(ps ...Plugin) *FakePluginStore {
	return &FakePluginStore{
		PluginList: ps,
	}
}

func (pr *FakePluginStore) Plugin(_ context.Context, pluginID string) (Plugin, bool) {
	// IDs before aliases, like the real registry: a plugin installed under an ID another plugin
	// claims as an alias wins.
	for _, v := range pr.PluginList {
		if v.ID == pluginID {
			return v, true
		}
	}

	for _, v := range pr.PluginList {
		if slices.Contains(v.AliasIDs, pluginID) {
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
