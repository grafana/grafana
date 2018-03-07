package upgrader

import (
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/netcrunch/config"
)

const DS_NETCRUNCH_90 = "netcrunch"

func upgradeFrom090(logger log.Logger) (bool) {
  if (config.SetInitializationSuccess() && config.RemoveUpgradeMarkerFile()) {
    logger.Info("Upgrade successful from 9.0")
    return true
  }

  logger.Info("Upgrade error from 9.0")
  return false
}
