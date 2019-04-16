package dashboards

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/log"
	"github.com/pkg/errors"
)

type DashboardProvisioner interface {
	Provision() error
	PollChanges(ctx context.Context) error
}

type DashboardProvisionerImpl struct {
	log         log.Logger
	fileReaders []*fileReader
	configs     []*DashboardsAsConfig
}

func NewDashboardProvisionerImpl(configDirectory string) (*DashboardProvisionerImpl, error) {
	logger := log.New("provisioning.dashboard")
	cfgReader := &configReader{path: configDirectory, log: logger}
	configs, err := cfgReader.readConfig()
	if err != nil {
		return nil, errors.Wrap(err, "Could not read dashboards config")
	}

	d := &DashboardProvisionerImpl{
		configs: configs,
		log:     logger,
	}

	return d, nil
}

func (provider *DashboardProvisionerImpl) Provision() error {
	readers, err := provider.getFileReaders()
	if err != nil {
		return err
	}

	for _, reader := range readers {
		err = reader.startWalkingDisk()
		if err != nil {
			return errors.Wrap(err, "Failed to provision config")
		}
	}

	return nil
}

// PollChanges starts polling for changes in dashboard definition files. It creates goruotine for each provider
// defined in the config.
func (provider *DashboardProvisionerImpl) PollChanges(ctx context.Context) error {
	readers, err := provider.getFileReaders()
	if err != nil {
		return err
	}

	for _, reader := range readers {
		go reader.pollChanges(ctx)
	}
	return nil
}

func (provider *DashboardProvisionerImpl) getFileReaders() ([]*fileReader, error) {
	var readers []*fileReader

	for _, config := range provider.configs {
		switch config.Type {
		case "file":
			fileReader, err := NewDashboardFileReader(config, provider.log.New("type", config.Type, "name", config.Name))
			if err != nil {
				return nil, errors.Wrapf(err, "Could not create file reader for config %v", config.Name)
			}
			readers = append(readers, fileReader)
		default:
			return nil, fmt.Errorf("type %s is not supported", config.Type)
		}
	}

	return readers, nil
}
