package dashboards

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/log"
)

type DashboardProvisioner struct {
	cfgReader *configReader
	log       log.Logger
}

func NewDashboardProvisioner(configDirectory string) *DashboardProvisioner {
	log := log.New("provisioning.dashboard")
	d := &DashboardProvisioner{
		cfgReader: &configReader{path: configDirectory, log: log},
		log:       log,
	}

	return d
}

func (provider *DashboardProvisioner) Provision(ctx context.Context) error {
	cfgs, err := provider.cfgReader.readConfig()
	if err != nil {
		return err
	}

	for _, cfg := range cfgs {
		switch cfg.Type {
		case "file":
			fileReader, err := NewDashboardFileReader(cfg, provider.log.New("type", cfg.Type, "name", cfg.Name))
			if err != nil {
				return err
			}

			go fileReader.ReadAndListen(ctx)
		default:
			return fmt.Errorf("type %s is not supported", cfg.Type)
		}
	}

	return nil
}
