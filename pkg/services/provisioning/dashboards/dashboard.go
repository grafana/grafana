package dashboards

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util/errutil"
)

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
		return nil, errutil.Wrap("Failed to read dashboards config", err)
	}

	fileReaders, err := getFileReaders(configs, logger)

	if err != nil {
		return nil, errutil.Wrap("Failed to initialize file readers", err)
	}

	d := &DashboardProvisionerImpl{
		log:         logger,
		fileReaders: fileReaders,
		configs:     configs,
	}

	return d, nil
}

func (provider *DashboardProvisionerImpl) Provision() error {
	for _, reader := range provider.fileReaders {
		if err := reader.startWalkingDisk(); err != nil {
			if os.IsNotExist(err) {
				// don't stop the provisioning service in case the folder is missing. The folder can appear after the startup
				provider.log.Warn("Failed to provision config", "name", reader.Cfg.Name, "error", err)
				return nil
			}

			return errutil.Wrapf(err, "Failed to provision config %v", reader.Cfg.Name)
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

// GetProvisionerResolvedPath returns resolved path for the specified provisioner name. Can be used to generate
// relative path to provisioning file from it's external_id.
func (provider *DashboardProvisionerImpl) GetProvisionerResolvedPath(name string) string {
	for _, reader := range provider.fileReaders {
		if reader.Cfg.Name == name {
			return reader.resolvedPath()
		}
	}
	return ""
}

func (provider *DashboardProvisionerImpl) GetAllowUiUpdatesFromConfig(name string) bool {
	for _, config := range provider.configs {
		if config.Name == name {
			return config.AllowUiUpdates
		}
	}
	return false
}

func getFileReaders(configs []*DashboardsAsConfig, logger log.Logger) ([]*fileReader, error) {
	var readers []*fileReader

	for _, config := range configs {
		switch config.Type {
		case "file":
			fileReader, err := NewDashboardFileReader(config, logger.New("type", config.Type, "name", config.Name))
			if err != nil {
				return nil, errutil.Wrapf(err, "Failed to create file reader for config %v", config.Name)
			}
			readers = append(readers, fileReader)
		default:
			return nil, fmt.Errorf("type %s is not supported", config.Type)
		}
	}

	return readers, nil
}
