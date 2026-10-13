package rules

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/store/provenance"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// RuleStore persists alert rules, their versions and the folders they live in.
type RuleStore struct {
	Cfg            setting.UnifiedAlertingSettings
	FeatureToggles featuremgmt.FeatureToggles
	SQLStore       db.DB
	Logger         log.Logger
	FolderService  folder.Service
	AccessControl  accesscontrol.AccessControl
	// Provenance is read when renaming receivers and time intervals, to honour provisioning
	// ownership. It is the only store the rule store depends on.
	Provenance ProvenanceReader
	// LegacyDatabaseProvider resolves table names for this store's SQL queries. If unset, queries
	// use bare table names.
	LegacyDatabaseProvider legacysql.LegacyDatabaseProvider
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
		// LegacyDatabaseProvider is left unset here: it must stay nil unless a deployment
		// explicitly routes to a different database, so DeleteAlertRulesByUID can tell "no routed
		// database" apart from "identity provider" and keep the folder-key read on sess.
		// legacyDatabaseProvider still supplies bare table names on demand when this is nil.
	}
	if err := folderService.RegisterService(&store); err != nil {
		return nil, err
	}
	return &store, nil
}

// legacyDatabaseProvider falls back to bare table names when LegacyDatabaseProvider is unset, so
// a RuleStore built directly (as in tests) keeps working unchanged.
func (st RuleStore) legacyDatabaseProvider(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
	if st.LegacyDatabaseProvider == nil {
		return legacysql.NewDatabaseProvider(st.SQLStore)(ctx)
	}
	return st.LegacyDatabaseProvider(ctx)
}

// withoutAmbientSession forces a fresh session, since sqlstore reuses whatever's on ctx without
// checking it came from the right db.DB.
func withoutAmbientSession(ctx context.Context) context.Context {
	return context.WithValue(ctx, sqlstore.ContextSessionKey{}, nil)
}
