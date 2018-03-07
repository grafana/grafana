package upgrader

import (
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/netcrunch/config"
)

func Upgrade() {
  var(
    upgradeSuccess bool = false
    uLog = log.New("GrafCrunch upgrader")
  )

  if (config.UpgradeMarkerFileExist()) {
    upgradeSuccess = upgradeFrom090(uLog)
  } else if version, err := config.ReadVersionFile(); (err == nil) {

    upTo094 := upgradeTo094(version, uLog)
    upTo100 := upgradeTo100(version, uLog)

    upgradeSuccess = (upTo094 || upTo100)
  }

  if (upgradeSuccess) {
    config.WriteVersionFile()
  }
}
