package searchV2

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type GitopsService struct {
	sql *sqlstore.SQLStore
}

func ProvideService(sql *sqlstore.SQLStore, features featuremgmt.FeatureToggles, cfg setting.Cfg) *GitopsService {
	fmt.Printf("DATA:%s\n", cfg.StaticRootPath)
	fmt.Printf("TOGGLES:%v\n", features.IsEnabled(featuremgmt.FlagDashboardPreviews))
	return &GitopsService{
		sql: sql,
	}
}

func (s *GitopsService) Run(ctx context.Context) error {
	fmt.Printf("XXXXXXXXXXXXXXXXX")
	return nil
}

func (s *GitopsService) HandleExportDashboards(ctx *models.ReqContext) {
	ctx.JSON(200, map[string]string{"hello": "world"})
}
