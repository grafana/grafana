package dtos

import "github.com/grafana/grafana/pkg/plugins"

type PluginSetting struct {
	Name         string                      `json:"name"`
	Type         string                      `json:"type"`
	Id           string                      `json:"id"`
	Enabled      bool                        `json:"enabled"`
	Pinned       bool                        `json:"pinned"`
	Module       string                      `json:"module"`
	BaseUrl      string                      `json:"baseUrl"`
	Info         *plugins.PluginInfo         `json:"info"`
	Pages        []*plugins.AppPluginPage    `json:"pages"`
	Includes     []*plugins.PluginInclude    `json:"includes"`
	Dependencies *plugins.PluginDependencies `json:"dependencies"`
	JsonData     map[string]interface{}      `json:"jsonData"`
}

type PluginListItem struct {
	Name    string              `json:"name"`
	Type    string              `json:"type"`
	Id      string              `json:"id"`
	Enabled bool                `json:"enabled"`
	Pinned  bool                `json:"pinned"`
	Info    *plugins.PluginInfo `json:"info"`
}

type ImportDashboardCommand struct {
	PluginId  string                         `json:"pluginId"`
	Path      string                         `json:"path"`
	Reinstall bool                           `json:"reinstall"`
	Inputs    []plugins.ImportDashboardInput `json:"inputs"`
}
