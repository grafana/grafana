package provisioning

import (
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
)

var (
	logger log.Logger = log.New("services.provisioning")
)

func StartUp(datasourcePath string) error {
	return datasources.Provision(datasourcePath)
}
