package upgrader

import "github.com/grafana/grafana/pkg/netcrunch/config"

func Upgrade() {
  var version string = "9.0.0"

  upTo092, err := upgradeTo092()

  if (notUpgradeTo092(upTo092, err)) {
    version, err = config.ReadVersionFile()
  }

  if (err == nil) {
    upTo094, err := upgradeTo094(version)
    upTo100, err := upgradeTo100(version)

    if ((err == nil) && (upTo094 || upTo100)) {
      config.WriteVersionFile()
    }
  }
}

func notUpgradeTo092(upTo092 bool, err error) bool {
  return !(upTo092 && (err == nil))
}
