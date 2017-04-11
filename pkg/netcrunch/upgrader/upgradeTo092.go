package upgrader

import (
  "errors"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/netcrunch/config"
)

func upgradeTo092() (bool, error) {
  uLog := log.New("GrafCrunch upgrader")
  UPGRADE_ERROR_MSG := "Upgrade to 9.2 error"

  if (config.ServerSettingsFileExist()) {
    if (!config.VersionFileExist() && updateNetCrunchDatasource() && config.RemoveServerSettingsFile()) {
      uLog.Info("Upgrade successful to 9.2")

      if (config.UpgradeMarkerFileExist()) {
	config.SetInitializationSuccess()
	config.RemoveUpgradeMarkerFile()
      }

      config.WriteVersionFile()
      return true, nil
    }
    uLog.Info(UPGRADE_ERROR_MSG)
    return false, errors.New(UPGRADE_ERROR_MSG)
  }

  return false, nil
}

func updateNetCrunchDatasource() bool {
  return true
}
