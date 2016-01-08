package dtos

import "github.com/grafana/grafana/pkg/plugins"

type AppPlugin struct {
	Name     string                 `json:"name"`
	Type     string                 `json:"type"`
	Enabled  bool                   `json:"enabled"`
	Pinned   bool                   `json:"pinned"`
	Module   string                 `json:"module"`
	Info     *plugins.PluginInfo    `json:"info"`
	JsonData map[string]interface{} `json:"jsonData"`
}
