package dashboards

import (
	"context"
	"fmt"
	"os"
	"time"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/provisioning/utils"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

// DashboardProvisioner is responsible for syncing dashboard from disk to
// Grafana's database.
type DashboardProvisioner interface {
	HasDashboardSources() bool
	Provision(ctx context.Context) error
	PollChanges(ctx context.Context)
	GetProvisionerResolvedPath(name string) string
	GetAllowUIUpdatesFromConfig(name string) bool
	CleanUpOrphanedDashboards(ctx context.Context)
}

// DashboardProvisionerFactory creates DashboardProvisioners based on input
type DashboardProvisionerFactory func(context.Context, string, dashboards.DashboardProvisioningService, org.Service, utils.DashboardStore, folder.Service, dualwrite.Service) (DashboardProvisioner, error)

// Provisioner is responsible for syncing dashboard from disk to Grafana's database.
type Provisioner struct {
	log                log.Logger
	fileReaders        []*FileReader
	configs            []*config
	duplicateValidator duplicateValidator
	provisioner        dashboards.DashboardProvisioningService
	dual               dualwrite.Service
}

func (provider *Provisioner) HasDashboardSources() bool {
	return len(provider.fileReaders) > 0
}

// New returns a new DashboardProvisioner
func New(ctx context.Context, configDirectory string, provisioner dashboards.DashboardProvisioningService, orgService org.Service, dashboardStore utils.DashboardStore, folderService folder.Service, dual dualwrite.Service) (DashboardProvisioner, error) {
	logger := log.New("provisioning.dashboard")
	cfgReader := &configReader{path: configDirectory, log: logger, orgExists: utils.NewOrgExistsChecker(orgService)}
	configs, err := cfgReader.readConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "Failed to read dashboards config", err)
	}

	fileReaders, err := getFileReaders(configs, logger, provisioner, dashboardStore, folderService)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "Failed to initialize file readers", err)
	}

	if dual != nil && !dual.ShouldManage(dashboard.DashboardResourceInfo.GroupResource()) {
		dual = nil // not actively managed
	}

	d := &Provisioner{
		log:                logger,
		fileReaders:        fileReaders,
		configs:            configs,
		duplicateValidator: newDuplicateValidator(logger, fileReaders),
		provisioner:        provisioner,
		dual:               dual,
	}

	return d, nil
}

// Provision scans the disk for dashboards and updates
// the database with the latest versions of those dashboards.
func (provider *Provisioner) Provision(ctx context.Context) error {
	// skip provisioning during migrations to prevent multi-replica instances from crashing when another replica is migrating
	if provider.dual != nil {
		status, _ := provider.dual.Status(context.Background(), dashboard.DashboardResourceInfo.GroupResource())
		if status.Migrating > 0 {
			provider.log.Info("dashboard migrations are running, skipping provisioning", "elapsed", time.Since(time.UnixMilli(status.Migrating)))
			return nil
		}
	}

	provider.log.Info("starting to provision dashboards")

	for _, reader := range provider.fileReaders {
		if err := reader.walkDisk(ctx); err != nil {
			if os.IsNotExist(err) {
				// don't stop the provisioning service in case the folder is missing. The folder can appear after the startup
				provider.log.Warn("Failed to provision config", "name", reader.Cfg.Name, "error", err)
				return nil
			}

			return fmt.Errorf("failed to provision config %v: %w", reader.Cfg.Name, err)
		}
	}

	provider.duplicateValidator.validate()
	provider.log.Info("finished to provision dashboards")
	return nil
}

// CleanUpOrphanedDashboards deletes provisioned dashboards missing a linked reader.
func (provider *Provisioner) CleanUpOrphanedDashboards(ctx context.Context) {
	currentReaders := make([]string, len(provider.fileReaders))

	for index, reader := range provider.fileReaders {
		currentReaders[index] = reader.Cfg.Name
	}

	if err := provider.provisioner.DeleteOrphanedProvisionedDashboards(ctx, &dashboards.DeleteOrphanedProvisionedDashboardsCommand{ReaderNames: currentReaders}); err != nil {
		provider.log.Warn("Failed to delete orphaned provisioned dashboards", "err", err)
	}
}

// PollChanges starts polling for changes in dashboard definition files. It creates a goroutine for each provider
// defined in the config.
func (provider *Provisioner) PollChanges(ctx context.Context) {
	for _, reader := range provider.fileReaders {
		go reader.pollChanges(ctx)
	}

	go provider.duplicateValidator.Run(ctx)
}

// GetProvisionerResolvedPath returns resolved path for the specified provisioner name. Can be used to generate
// relative path to provisioning file from its external_id.
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

func getFileReaders(
	configs []*config,
	logger log.Logger,
	service dashboards.DashboardProvisioningService,
	store utils.DashboardStore,
	folderService folder.Service,
) ([]*FileReader, error) {
	var readers []*FileReader

	for _, config := range configs {
		switch config.Type {
		case "file":
			fileReader, err := NewDashboardFileReader(
				config,
				logger.New("type", config.Type, "name", config.Name),
				service,
				store,
				folderService,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to create file reader for config %v: %w", config.Name, err)
			}
			readers = append(readers, fileReader)
		default:
			return nil, fmt.Errorf("type %s is not supported", config.Type)
		}
	}

	return readers, nil
}
