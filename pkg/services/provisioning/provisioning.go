package provisioning

import (
	"path/filepath"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
)

var (
	logger log.Logger = log.New("services.provisioning")
)

func StartUp(homePath string) error {
	return datasources.Apply(filepath.Join(homePath, "conf/datasources.yaml"))
}
