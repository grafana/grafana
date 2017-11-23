package dashboard

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/log"
)

type DashboardProvisioner struct {
	cfgReader *configReader
	log       log.Logger
	ctx       context.Context
}

func Provision(ctx context.Context, configDirectory string) (*DashboardProvisioner, error) {
	d := &DashboardProvisioner{
		cfgReader: &configReader{path: configDirectory},
		log:       log.New("provisioning.dashboard"),
		ctx:       ctx,
	}

	return d, d.Init(ctx)
}

func (provider *DashboardProvisioner) Init(ctx context.Context) error {
	cfgs, err := provider.cfgReader.readConfig()
	if err != nil {
		return err
	}

	for _, cfg := range cfgs {
		if cfg.Type == "file" {
			fileReader, err := NewDashboardFilereader(cfg, provider.log.New("type", cfg.Type, "name", cfg.Name))
			if err != nil {
				return err
			}

			// err = fileReader.Init()
			// if err != nil {
			// 	provider.log.Error("Failed to load dashboards", "error", err)
			// }

			go fileReader.Listen(ctx)
		} else {
			return fmt.Errorf("type %s is not supported", cfg.Type)
		}
	}

	return nil
}
