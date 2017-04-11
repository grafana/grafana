package upgrader

import "github.com/grafana/grafana/pkg/netcrunch/config"

func upgradeTo100(version string) (bool, error) {

  if compare, err := config.CompareVersions(version, "10.0.0"); ((compare < 0) && (err == nil)) {

  }

  return false, nil
}
