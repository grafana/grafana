package dtos

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

type AppSettings struct {
	Name     string                   `json:"name"`
	AppId    string                   `json:"appId"`
	Enabled  bool                     `json:"enabled"`
	Pinned   bool                     `json:"pinned"`
	Module   string                   `json:"module"`
	Info     *plugins.PluginInfo      `json:"info"`
	Pages    []*plugins.AppPluginPage `json:"pages"`
	JsonData map[string]interface{}   `json:"jsonData"`
}

func NewAppSettingsDto(def *plugins.AppPlugin, data *models.AppSettings) *AppSettings {
	dto := &AppSettings{
		AppId:  def.Id,
		Name:   def.Name,
		Info:   &def.Info,
		Module: def.Module,
		Pages:  def.Pages,
	}

	if data != nil {
		dto.Enabled = data.Enabled
		dto.Pinned = data.Pinned
		dto.Info = &def.Info
	}

	return dto
}
