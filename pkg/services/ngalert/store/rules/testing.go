package rules

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/store/provenance"
	"github.com/grafana/grafana/pkg/setting"
)

func SetupStoreForTesting(t *testing.T, db db.DB) *RuleStore {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{BaseInterval: 1 * time.Second}

	store := &RuleStore{
		Cfg:            cfg.UnifiedAlerting,
		FeatureToggles: featuremgmt.WithFeatures(),
		SQLStore:       db,
		Logger:         &logtest.Fake{},
		FolderService:  foldertest.NewFakeService(),
		// Real, not a fake: the rename tests exercise provenance filtering end to end.
		Provenance: provenance.SetupStoreForTesting(t, db),
	}
	return store
}
