package netcrunch

import (
  "github.com/grafana/grafana/pkg/netcrunch/config"
  "github.com/grafana/grafana/pkg/netcrunch/model"
  "github.com/grafana/grafana/pkg/netcrunch/upgrader"
)

const NETCRUNCH_APP_PLUGIN_ID_10 string = "adremsoft-netcrunch-app"

func CheckInitializationSuccess() (bool, error) {
  return config.CheckInitializationSuccess()
}

func SetInitializationSuccess() (bool) {
  return config.SetInitializationSuccess()
}

func initNetCrunchPlugin() {
  model.SetPluginAsCore(NETCRUNCH_APP_PLUGIN_ID_10)

  if orgs, found := model.GetOrgs(); found {
    model.EnablePluginForOrgs(orgs, NETCRUNCH_APP_PLUGIN_ID_10)
  }
}

func Init() {
  if (config.CreateDefaultStatusesFile()) {
    upgrader.Upgrade()
  }
  initNetCrunchPlugin()
}
