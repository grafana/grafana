package rules

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/setting"
)

func SetupStoreForTesting(t *testing.T, db db.DB) *RuleStore {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{BaseInterval: 1 * time.Second}

	folderService := foldertest.NewFakeService()

	store := &RuleStore{
		SQLStore:      db,
		Cfg:           cfg.UnifiedAlerting,
		Logger:        &logtest.Fake{},
		FolderService: folderService,
		Bus:           bus.ProvideBus(tracing.InitializeTracerForTest()),
	}
	return store
}
