package datasources

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/plugins/manager"
)

const (
	adminUserID = 1
	orgID       = 1
)

var logger = log.New("datasource_initializer")

func ProvideInitializerService(dataSourceCache CacheService, plugReqValidator models.PluginRequestValidator,
	pm plugins.Manager,
	pluginManager *manager.PluginManager) *DataSourceInitializerService {
	return &DataSourceInitializerService{
		DataSourceCache:    dataSourceCache,
		PluginManager:      pm,
		OtherPluginManager: pluginManager,
	}
}

type DataSourceInitializerService struct {
	DataSourceCache    CacheService
	PluginManager      plugins.Manager
	OtherPluginManager *manager.PluginManager
}

func (di *DataSourceInitializerService) Run(ctx context.Context) error {
	query := models.GetDataSourcesQuery{OrgId: orgID, DataSourceLimit: -1}

	if err := bus.Dispatch(&query); err != nil {
		return fmt.Errorf("failed to query datasources: %v", err)
	}

	for _, ds := range query.Result {
		err := di.CheckDatasourceHealth(ds.Id, ds.Name)
		if err != nil {
			logger.Error("error checking datasource: %v", err)
		}
	}
	return nil
}

// CheckDatasourceHealth sends a health check request to the plugin datasource
func (di *DataSourceInitializerService) CheckDatasourceHealth(datasourceID int64, datasourceName string) error {
	adminUser := models.SignedInUser{
		UserId:  adminUserID,
		Name:    "admin",
		OrgId:   orgID,
		OrgRole: "admin",
	}

	ds, err := di.DataSourceCache.GetDatasource(datasourceID, &adminUser, true)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceAccessDenied) {
			return fmt.Errorf("access denied to datasource: %v", err)
		}
		return fmt.Errorf("unable to load datasource metadata: %v", err)
	}

	plugin := di.PluginManager.GetDataSource(ds.Type)
	if plugin == nil {
		return fmt.Errorf("unable to find datasource plugin: %v", err)
	}

	dsInstanceSettings, err := adapters.ModelToInstanceSettings(ds)
	if err != nil {
		return fmt.Errorf("unable to get datasource model: %v", err)
	}
	pCtx := backend.PluginContext{
		User:                       adapters.BackendUserFromSignedInUser(&adminUser),
		OrgID:                      adminUser.OrgId,
		PluginID:                   plugin.Id,
		DataSourceInstanceSettings: dsInstanceSettings,
	}

	ctx := context.Background()
	resp, err := di.OtherPluginManager.BackendPluginManager.CheckHealth(ctx, pCtx)
	if err != nil {
		return err
	}

	if resp.Status != backend.HealthStatusOk {
		logger.Error("Plugin %s responded %s to initialize", datasourceName, resp.Status.String())
	} else {
		logger.Info("Plugin %s responded %s to initialize", datasourceName, resp.Status.String())
	}
	return nil
}
