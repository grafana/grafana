package dashboards

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/log"
	"github.com/pkg/errors"
)

type DashboardProvisioner interface {
	Provision() error
	PollChanges(ctx context.Context)
}

type DashboardProvisionerImpl struct {
	log         log.Logger
	fileReaders []*fileReader
}

type DashboardProvisionerFactory func(string) (DashboardProvisioner, error)

func NewDashboardProvisionerImpl(configDirectory string) (*DashboardProvisionerImpl, error) {
	logger := log.New("provisioning.dashboard")
	cfgReader := &configReader{path: configDirectory, log: logger}
	configs, err := cfgReader.readConfig()

	if err != nil {
		return nil, errors.Wrap(err, "Failed to read dashboards config")
	}

	fileReaders, err := getFileReaders(configs, logger)

	if err != nil {
		return nil, errors.Wrap(err, "Failed to initialize file readers")
	}

	d := &DashboardProvisionerImpl{
		log:         logger,
		fileReaders: fileReaders,
	}

	return d, nil
}

func (provider *DashboardProvisionerImpl) Provision() error {
	for _, reader := range provider.fileReaders {
		err := reader.startWalkingDisk()
		if err != nil {
			return errors.Wrapf(err, "Failed to provision config %v", reader.Cfg.Name)
		}
	}

	return nil
}

// PollChanges starts polling for changes in dashboard definition files. It creates goroutine for each provider
// defined in the config.
func (provider *DashboardProvisionerImpl) PollChanges(ctx context.Context) {
	for _, reader := range provider.fileReaders {
		go reader.pollChanges(ctx)
	}
}

func getFileReaders(configs []*DashboardsAsConfig, logger log.Logger) ([]*fileReader, error) {
	var readers []*fileReader

	for _, config := range configs {
		switch config.Type {
		case "file":
			fileReader, err := NewDashboardFileReader(config, logger.New("type", config.Type, "name", config.Name))
			if err != nil {
				return nil, errors.Wrapf(err, "Failed to create file reader for config %v", config.Name)
			}
			readers = append(readers, fileReader)
		default:
			return nil, fmt.Errorf("type %s is not supported", config.Type)
		}
	}

	return readers, nil
}
