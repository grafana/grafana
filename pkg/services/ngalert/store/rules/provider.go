package rules

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/store/provenance"
	"github.com/grafana/grafana/pkg/setting"
)

// RuleStore persists alert rules, their versions and the folders they live in.
type RuleStore struct {
	Cfg            setting.UnifiedAlertingSettings
	FeatureToggles featuremgmt.FeatureToggles
	SQLStore       db.DB
	Logger         log.Logger
	// FolderService is read by test helpers as well as by this package.
	FolderService folder.Service
	AccessControl accesscontrol.AccessControl
	// Provenance lets rule writes honour provisioning ownership when renaming receivers and time
	// intervals. This is the only place the rule store reaches into another store's table.
	Provenance ProvenanceReader
}

func ProvideRuleStore(
	cfg *setting.Cfg,
	featureToggles featuremgmt.FeatureToggles,
	sqlstore db.DB,
	folderService folder.Service,
	ac accesscontrol.AccessControl,
	provenanceStore *provenance.ProvenanceStore,
) (*RuleStore, error) {
	store := RuleStore{
		Cfg:            cfg.UnifiedAlerting,
		FeatureToggles: featureToggles,
		SQLStore:       sqlstore,
		Logger:         log.New("ngalert.rulestore"),
		FolderService:  folderService,
		AccessControl:  ac,
		Provenance:     provenanceStore,
	}
	if err := folderService.RegisterService(store); err != nil {
		return nil, err
	}
	return &store, nil
}
