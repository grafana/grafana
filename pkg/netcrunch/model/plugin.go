package model

import (
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/bus"
  "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/plugins"
)

func getPluginByOrg(orgId int64, pluginId string) (*models.PluginSetting, bool) {
  query := models.GetPluginSettingByIdQuery {
    PluginId: pluginId,
    OrgId: orgId,
  }

  err := bus.Dispatch(&query)
  return query.Result, (err == nil)
}

func enablePluginForOrg(orgId int64, pluginId string) bool {
  command := models.UpdatePluginSettingCmd {
    PluginId: pluginId,
    OrgId: orgId,
    Enabled: true,
    Pinned: true,
  }

  return (bus.Dispatch(&command) == nil)
}

func EnablePluginForOrgs(orgs []*models.OrgDTO, pluginId string) {
  pLog := log.New("plugins")

  for index := range orgs {
    pluginSetting, err := getPluginByOrg(orgs[index].Id, pluginId)

    if (!err && (pluginSetting == nil)) {
      enablePluginForOrg(orgs[index].Id, pluginId)
      pLog.Info("Enabling " + plugins.Plugins[pluginId].Id  + " Plugin for " + orgs[index].Name)
    }
  }
}

func SetPluginAsCore(pluginId string) {
  if netCrunchPlugin, exist := plugins.Plugins[pluginId]; exist {
    netCrunchPlugin.IsCorePlugin = true
  }
}
