package dashboards

import (
	"context"
	"fmt"
	"github.com/pkg/errors"
	"time"

	"github.com/grafana/grafana/pkg/log"
)

type DashboardProvisioner interface {
	Provision() error
	PollChanges(ctx context.Context) error
}

type DashboardProvisionerImpl struct {
	cfgReader   *configReader
	log         log.Logger
	fileReaders []*fileReader
}

func NewDashboardProvisionerImpl(configDirectory string) *DashboardProvisionerImpl {
	log := log.New("provisioning.dashboard")
	d := &DashboardProvisionerImpl{
		cfgReader: &configReader{path: configDirectory, log: log},
		log:       log,
	}

	return d
}

func (provider *DashboardProvisionerImpl) Provision() error {
	readers, err := provider.getFileReaders()
	if err != nil {
		return err
	}

	for _, reader := range readers {
		err = reader.startWalkingDisk()
		if err != nil {
			return errors.Wrapf(err, "Failed walking disc for config %v", reader.Cfg.Name)
		}
	}

	return nil
}

// PollChanges starts polling for changes in dashboard definition files. It creates goruotine for each provider
// defined in the config and walks the file system each UpdateIntervalSeconds as defined in the provider config.
func (provider *DashboardProvisionerImpl) PollChanges(ctx context.Context) error {
	readers, err := provider.getFileReaders()
	if err != nil {
		return err
	}

	for _, reader := range readers {
		go provider.pollChangesForFileReader(ctx, reader)
	}
	return nil
}

func (provider *DashboardProvisionerImpl) pollChangesForFileReader(ctx context.Context, fileReader *fileReader) {
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

func (provider *DashboardProvisionerImpl) getFileReaders() ([]*fileReader, error) {
	configs, err := provider.cfgReader.readConfig()
	if err != nil {
		return nil, err
	}

	var readers []*fileReader

	for _, config := range configs {
		switch config.Type {
		case "file":
			fileReader, err := NewDashboardFileReader(config, provider.log.New("type", config.Type, "name", config.Name))
			if err != nil {
				return nil, err
			}
			readers = append(readers, fileReader)
		default:
			return nil, fmt.Errorf("type %s is not supported", config.Type)
		}
	}

	return readers, nil
}
