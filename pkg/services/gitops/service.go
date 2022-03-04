package gitops

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type GitopsService interface {
	registry.BackgroundService
	HandleExportSystem(ctx *models.ReqContext)
	HandleImportSystem(ctx *models.ReqContext)
}

type standardGitopsService struct {
	sql *sqlstore.SQLStore
}

func ProvideService(sql *sqlstore.SQLStore, features featuremgmt.FeatureToggles, cfg *setting.Cfg) GitopsService {
	fmt.Printf("DATA:%s\n", cfg.StaticRootPath)
	fmt.Printf("TOGGLES:%v\n", features.IsEnabled(featuremgmt.FlagDashboardPreviews))
	return &standardGitopsService{
		sql: sql,
	}
}

func (s *standardGitopsService) Run(ctx context.Context) error {
	fmt.Printf("XXXXXXXXXXXXXXXXX")
	// setup listeners and webhooks?
	return nil
}

func (s *standardGitopsService) HandleExportSystem(ctx *models.ReqContext) {
	dir, err := os.MkdirTemp("", "dashboard_export_")
	if err != nil {
		ctx.JsonApiErr(500, "init error", err)
		return
	}

	err = exportDashboards(ctx.Req.Context(), ctx.OrgId, s.sql, dir)
	if err != nil {
		ctx.JsonApiErr(500, "export error", err)
		return
	}

	ctx.JSON(200, map[string]string{"export": dir})
}

func (s *standardGitopsService) HandleImportSystem(ctx *models.ReqContext) {
	ctx.JSON(200, map[string]string{"TODO": "import"})
}
