package store

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type StorageService interface {
	registry.BackgroundService

	GetStorageStatus(c *models.ReqContext) response.Response
	Save(c *models.ReqContext, kind string, id string) response.Response
	Delete(c *models.ReqContext, kind string, id string) response.Response

	HandleExportSystem(c *models.ReqContext) response.Response
	HandleImportSystem(c *models.ReqContext) response.Response
}

type standardStorageService struct {
	sql *sqlstore.SQLStore
}

func ProvideService(sql *sqlstore.SQLStore, features featuremgmt.FeatureToggles, cfg *setting.Cfg) StorageService {
	fmt.Printf("DATA:%s\n", cfg.StaticRootPath)
	fmt.Printf("TOGGLES:%v\n", features.IsEnabled(featuremgmt.FlagDashboardPreviews))
	return &standardStorageService{
		sql: sql,
	}
}

func (s *standardStorageService) Run(ctx context.Context) error {
	fmt.Printf("XXXXXXXXXXXXXXXXX")
	// setup listeners and webhooks?
	return nil
}

func (s *standardStorageService) HandleExportSystem(c *models.ReqContext) response.Response {
	dir, err := os.MkdirTemp("", "dashboard_export_")
	if err != nil {
		return response.Error(500, "init error", err)
	}

	err = exportToRepo(c.Req.Context(), c.OrgId, s.sql, dir)
	if err != nil {
		return response.Error(500, "export error", err)
	}

	return response.JSON(200, map[string]string{"export": dir})
}

func (s *standardStorageService) HandleImportSystem(c *models.ReqContext) response.Response {
	return response.JSON(200, map[string]string{"TODO": "import"})
}

func (s *standardStorageService) GetStorageStatus(c *models.ReqContext) response.Response {
	sss := &StorageStatus{
		OrgID: 10,
	}

	return response.JSON(200, sss)
}

func (s *standardStorageService) Save(c *models.ReqContext, kind string, id string) response.Response {
	sss := &StorageStatus{
		OrgID: 11,
	}

	return response.JSON(200, sss)
}

func (s *standardStorageService) Delete(c *models.ReqContext, kind string, id string) response.Response {
	sss := &StorageStatus{
		OrgID: 12,
	}

	return response.JSON(200, sss)
}
