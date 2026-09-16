package rules

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
)

type RuleStore struct {
	Cfg              setting.UnifiedAlertingSettings
	FeatureToggles   featuremgmt.FeatureToggles
	SQLStore         db.DB
	Logger           log.Logger
	FolderService    folder.Service
	DashboardService dashboards.DashboardService
	AccessControl    accesscontrol.AccessControl
	Bus              bus.Bus
}

func ProvideRuleStore(
	cfg *setting.Cfg,
	featureToggles featuremgmt.FeatureToggles,
	sqlstore db.DB,
	folderService folder.Service,
	dashboards dashboards.DashboardService,
	ac accesscontrol.AccessControl,
	bus bus.Bus,
) (*RuleStore, error) {
	store := RuleStore{
		Cfg:              cfg.UnifiedAlerting,
		FeatureToggles:   featureToggles,
		SQLStore:         sqlstore,
		Logger:           log.New("ngalert.RuleStore.rulestore"),
		FolderService:    folderService,
		DashboardService: dashboards,
		AccessControl:    ac,
		Bus:              bus,
	}
	if err := folderService.RegisterService(store); err != nil {
		return nil, err
	}
	return &store, nil
}
