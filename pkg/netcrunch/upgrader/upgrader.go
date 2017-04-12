package upgrader

import (
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/netcrunch/config"
)

func Upgrade() {
  var(
    upgradeSuccess bool = false
    uLog = log.New("GrafCrunch upgrader")
    upTo094 bool = false
    upTo100 bool = false
  )

  if (config.UpgradeMarkerFileExist()) {
    upgradeSuccess = upgradeFrom090(uLog)
  } else if version, err := config.ReadVersionFile(); (err == nil) {

    if upTo094, err = upgradeTo094(version, uLog); (err == nil) {
      upTo100, err = upgradeTo100(version, uLog)
    }

    upgradeSuccess = ((err == nil) && (upTo094 || upTo100))
  }

  if (upgradeSuccess){
    config.WriteVersionFile()
  }
}
