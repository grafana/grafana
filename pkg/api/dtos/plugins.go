package dtos

import "github.com/grafana/grafana/pkg/plugins"

type PluginSetting struct {
	Name         string                      `json:"name"`
	Type         string                      `json:"type"`
	PluginId     string                      `json:"pluginId"`
	Enabled      bool                        `json:"enabled"`
	Pinned       bool                        `json:"pinned"`
	Module       string                      `json:"module"`
	BaseUrl      string                      `json:"baseUrl"`
	Info         *plugins.PluginInfo         `json:"info"`
	Pages        []*plugins.AppPluginPage    `json:"pages"`
	Includes     []*plugins.AppIncludeInfo   `json:"includes"`
	Dependencies *plugins.PluginDependencies `json:"dependencies"`
	JsonData     map[string]interface{}      `json:"jsonData"`
}

type PluginListItem struct {
	Name     string              `json:"name"`
	Type     string              `json:"type"`
	PluginId string              `json:"pluginId"`
	Enabled  bool                `json:"enabled"`
	Pinned   bool                `json:"pinned"`
	Info     *plugins.PluginInfo `json:"info"`
}
