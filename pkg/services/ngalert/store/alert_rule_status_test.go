package store

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	tutil "github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationSaveAlertRuleStatus(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{BaseInterval: time.Second}
	sqlStore := db.InitTestDB(t)
	logger := &logtest.Fake{}
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
	ctx := context.Background()

	gen := models.RuleGen.With(models.RuleGen.WithIntervalMatching(store.Cfg.BaseInterval))
	rule := createRule(t, store, gen)

	getRule := func() *models.AlertRule {
		got, err := store.GetAlertRuleByUID(ctx, &models.GetAlertRuleByUIDQuery{OrgID: rule.OrgID, UID: rule.UID})
		require.NoError(t, err)
		return got
	}

	// A freshly created rule has no status yet.
	require.Empty(t, getRule().K8sStatus)

	t.Run("round-trips the status blob", func(t *testing.T) {
		status := []byte(`{"health":"OK","state":"Normal"}`)
		require.NoError(t, store.SaveAlertRuleStatus(ctx, rule.OrgID, rule.UID, status))
		require.Equal(t, status, getRule().K8sStatus)

		// Overwrite replaces the previous value.
		status2 := []byte(`{"health":"Error"}`)
		require.NoError(t, store.SaveAlertRuleStatus(ctx, rule.OrgID, rule.UID, status2))
		require.Equal(t, status2, getRule().K8sStatus)
	})

	t.Run("does not bump version or updated", func(t *testing.T) {
		before := getRule()
		require.NoError(t, store.SaveAlertRuleStatus(ctx, before.OrgID, before.UID, []byte(`{"health":"NoData"}`)))
		after := getRule()
		require.Equal(t, before.Version, after.Version, "status write must not bump version")
		require.True(t, before.Updated.Equal(after.Updated), "status write must not bump updated")
	})

	t.Run("spec update preserves status", func(t *testing.T) {
		status := []byte(`{"health":"OK","state":"Firing"}`)
		require.NoError(t, store.SaveAlertRuleStatus(ctx, rule.OrgID, rule.UID, status))

		existing := getRule()
		newRule := models.CopyRule(existing)
		newRule.Title = util.GenerateShortUID()
		usr := models.UserUID("1234")
		require.NoError(t, store.UpdateAlertRules(ctx, &usr, []models.UpdateRule{{
			Existing: existing,
			New:      *newRule,
		}}))

		updated := getRule()
		require.Equal(t, newRule.Title, updated.Title, "spec update should have applied")
		require.Equal(t, status, updated.K8sStatus, "spec update must not clobber status")
	})
}
