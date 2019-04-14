package dashboards

import (
	"context"
	"fmt"
	"github.com/pkg/errors"
	"time"

	"github.com/grafana/grafana/pkg/log"
)

type DashboardProvisioner struct {
	cfgReader   *configReader
	log         log.Logger
	fileReaders []*fileReader
}

func NewDashboardProvisioner(configDirectory string) *DashboardProvisioner {
	log := log.New("provisioning.dashboard")
	d := &DashboardProvisioner{
		cfgReader: &configReader{path: configDirectory, log: log},
		log:       log,
	}

	return d
}

func (provider *DashboardProvisioner) Provision() error {
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
			provider.fileReaders = append(provider.fileReaders, fileReader)

			err = fileReader.startWalkingDisk()
			if err != nil {
				return errors.Wrapf(err, "Failed walking disc for config %v", cfg.Name)
			}
		default:
			return fmt.Errorf("type %s is not supported", cfg.Type)
		}
	}

	return nil
}

func (provider *DashboardProvisioner) PollChanges(ctx context.Context) {
	for _, fr := range provider.fileReaders {
		go provider.pollChangesForFileReader(ctx, fr)
	}
}

func (provider *DashboardProvisioner) pollChangesForFileReader(ctx context.Context, fileReader *fileReader) {
	ticker := time.NewTicker(time.Duration(int64(time.Second) * fileReader.Cfg.UpdateIntervalSeconds))

	running := false

	for {
		select {
		case <-ticker.C:
			if !running { // avoid walking the filesystem in parallel. in-case fs is very slow.
				running = true
				go func() {
					fileReader.log.Debug("Tick start walking disc", "fileReader", fileReader.Cfg.Name)
					if err := fileReader.startWalkingDisk(); err != nil {
						fileReader.log.Error("failed to search for dashboards", "error", err)
					}
					running = false
				}()
			}
		case <-ctx.Done():
			return
		}
	}
}
