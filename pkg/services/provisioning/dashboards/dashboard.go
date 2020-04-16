package dashboards

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// DashboardProvisioner is responsible for syncing dashboard from disc to
// Grafanas database.
type DashboardProvisioner interface {
	Provision() error
	PollChanges(ctx context.Context)
	GetProvisionerResolvedPath(name string) string
	GetAllowUIUpdatesFromConfig(name string) bool
}

// DashboardProvisionerFactory creates DashboardProvisioners based on input
type DashboardProvisionerFactory func(string) (DashboardProvisioner, error)

// Provisioner is responsible for syncing dashboard from disc to Grafanas database.
type Provisioner struct {
	log         log.Logger
	fileReaders []*FileReader
	configs     []*config
}

// New returns a new DashboardProvisioner
func New(configDirectory string) (*Provisioner, error) {
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

	d := &Provisioner{
		log:         logger,
		fileReaders: fileReaders,
		configs:     configs,
	}

	return d, nil
}

// Provision starts scanning the disc for dashboards and updates
// the database with the latest versions of those dashboards
func (provider *Provisioner) Provision() error {
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
func (provider *Provisioner) PollChanges(ctx context.Context) {
	for _, reader := range provider.fileReaders {
		go reader.pollChanges(ctx)
	}
}

// GetProvisionerResolvedPath returns resolved path for the specified provisioner name. Can be used to generate
// relative path to provisioning file from it's external_id.
func (provider *Provisioner) GetProvisionerResolvedPath(name string) string {
	for _, reader := range provider.fileReaders {
		if reader.Cfg.Name == name {
			return reader.resolvedPath()
		}
	}
	return ""
}

// GetAllowUIUpdatesFromConfig return if a dashboard provisioner allows updates from the UI
func (provider *Provisioner) GetAllowUIUpdatesFromConfig(name string) bool {
	for _, config := range provider.configs {
		if config.Name == name {
			return config.AllowUIUpdates
		}
	}
	return false
}

func getFileReaders(configs []*config, logger log.Logger) ([]*FileReader, error) {
	var readers []*FileReader

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
