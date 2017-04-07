package netcrunch

import (
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/bus"
  "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/plugins"
)

const (
  NETCRUNCH_APP_PLUGIN_ID string = "adremsoft-netcrunch-app"
)

func getNetCrunchPluginByOrg(orgId int64) (*models.PluginSetting, bool) {
  query := models.GetPluginSettingByIdQuery {
    PluginId: NETCRUNCH_APP_PLUGIN_ID,
    OrgId: orgId,
  }

  err := bus.Dispatch(&query)
  return query.Result, (err == nil)
}

func enableNetCrunchPluginForOrg(orgId int64) bool {
  command := models.UpdatePluginSettingCmd {
    PluginId: NETCRUNCH_APP_PLUGIN_ID,
    OrgId: orgId,
    Enabled: true,
    Pinned: true,
  }

  return (bus.Dispatch(&command) == nil)
}

func enableNetCrunchPluginForOrgs(orgs []*models.OrgDTO) {
  pLog := log.New("plugins")

  for index := range orgs {
    pluginSetting, err := getNetCrunchPluginByOrg(orgs[index].Id)

    if (!err && (pluginSetting == nil)) {
      enableNetCrunchPluginForOrg(orgs[index].Id)
      pLog.Info("Enabling NetCrunch Plugin for " + orgs[index].Name)
    }
  }
}

func initNetCrunchPlugin() {

  if netCrunchPlugin, exist := plugins.Plugins[NETCRUNCH_APP_PLUGIN_ID]; exist {
    netCrunchPlugin.IsCorePlugin = true

    if orgs, found := getOrgs(); found {
      enableNetCrunchPluginForOrgs(orgs)
    }
  }
}
