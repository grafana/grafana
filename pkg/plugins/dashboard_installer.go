package plugins

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type InstallPluginDashboardCommand struct {
	Path   string                 `json:"string"`
	Inputs map[string]interface{} `json:"inputs"`

	OrgId    int64  `json:"-"`
	UserId   int64  `json:"-"`
	PluginId string `json:"-"`
	Result   *PluginDashboardInfoDTO
}

func init() {
	bus.AddHandler("plugins", InstallPluginDashboard)
}

func InstallPluginDashboard(cmd *InstallPluginDashboardCommand) error {
	plugin, exists := Plugins[cmd.PluginId]

	if !exists {
		return PluginNotFoundError{cmd.PluginId}
	}

	var dashboard *m.Dashboard
	var err error

	if dashboard, err = loadPluginDashboard(plugin, cmd.Path); err != nil {
		return err
	}

	saveCmd := m.SaveDashboardCommand{
		Dashboard: dashboard.Data,
		OrgId:     cmd.OrgId,
		UserId:    cmd.UserId,
	}

	if err := bus.Dispatch(&saveCmd); err != nil {
		return err
	}

	cmd.Result = &PluginDashboardInfoDTO{
		PluginId:          cmd.PluginId,
		Title:             dashboard.Title,
		Path:              cmd.Path,
		Revision:          dashboard.GetString("revision", "1.0"),
		InstalledURI:      "db/" + saveCmd.Result.Slug,
		InstalledRevision: dashboard.GetString("revision", "1.0"),
	}

	return nil
}
