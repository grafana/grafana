package upgrader

import "github.com/grafana/grafana/pkg/netcrunch/config"

func upgradeTo094(version string) (bool, error) {

  if compare, err := config.CompareVersions(version, "9.4.0"); ((compare < 0) && (err == nil)) {

  }

  return false, nil
}
