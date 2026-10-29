package statsimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/setting"
	tutil "github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationStatsRuleCounts(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)
	restoreUserStatsCache(t)

	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	ruleStore := rules.SetupStoreForTesting(t, sqlStore)
	service := newRuleCountStatsService(sqlStore, ruleStore)

	// The count is intentionally independent of the unified alerting setting.
	require.False(t, service.IsUnifiedAlertingEnabled())

	t.Run("zero rules", func(t *testing.T) {
		system, err := service.GetSystemStats(context.Background(), &stats.GetSystemStatsQuery{})
		require.NoError(t, err)
		assert.Zero(t, system.AlertRules)
		assert.Zero(t, system.RuleGroups)

		admin, err := service.GetAdminStats(context.Background(), &stats.GetAdminStatsQuery{})
		require.NoError(t, err)
		assert.Zero(t, admin.Alerts)
	})

	insertAlertRules(t, ruleStore, []models.AlertRule{
		newAlertRule(1, "folder-one", "shared", false),
		newAlertRule(1, "folder-two", "shared", true),
		newAlertRule(2, "folder-three", "shared", false),
		newAlertRule(1, "folder-one", "first-org-only", false),
		newAlertRule(2, "folder-three", "second-org-only", true),
	})

	for _, enabled := range []bool{false, true} {
		name := "disabled alerting with stored rules"
		if enabled {
			name = "enabled alerting with stored rules"
		}
		t.Run(name, func(t *testing.T) {
			service.cfg.UnifiedAlerting.Enabled = &enabled
			system, err := service.GetSystemStats(context.Background(), &stats.GetSystemStatsQuery{})
			require.NoError(t, err)
			assert.Equal(t, int64(5), system.AlertRules)
			assert.Equal(t, int64(3), system.RuleGroups)

			admin, err := service.GetAdminStats(context.Background(), &stats.GetAdminStatsQuery{})
			require.NoError(t, err)
			assert.Equal(t, int64(5), admin.Alerts)
		})
	}
}

func TestIntegrationStatsRuleCountFailures(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)
	restoreUserStatsCache(t)

	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	wantErr := errors.New("rule store unavailable")

	tests := []struct {
		name           string
		call           func(*sqlStatsService) error
		countErr       error
		groupCountErr  error
		wantError      string
		wantCountCalls []int64
		wantGroupCalls []int64
	}{
		{
			name: "system alert rule count failure",
			call: func(service *sqlStatsService) error {
				_, err := service.GetSystemStats(context.Background(), &stats.GetSystemStatsQuery{})
				return err
			},
			countErr:       wantErr,
			wantError:      "counting alert rules",
			wantCountCalls: []int64{0},
		},
		{
			name: "system rule group count failure",
			call: func(service *sqlStatsService) error {
				_, err := service.GetSystemStats(context.Background(), &stats.GetSystemStatsQuery{})
				return err
			},
			groupCountErr:  wantErr,
			wantError:      "counting rule groups",
			wantCountCalls: []int64{0},
			wantGroupCalls: []int64{0},
		},
		{
			name: "admin alert rule count failure",
			call: func(service *sqlStatsService) error {
				_, err := service.GetAdminStats(context.Background(), &stats.GetAdminStatsQuery{})
				return err
			},
			countErr:       wantErr,
			wantError:      "counting alert rules",
			wantCountCalls: []int64{0},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ruleStore := &ruleStoreOverride{countErr: tc.countErr, groupCountErr: tc.groupCountErr}
			err := tc.call(newRuleCountStatsService(sqlStore, ruleStore))

			require.ErrorIs(t, err, wantErr)
			assert.ErrorContains(t, err, tc.wantError)
			assert.Equal(t, tc.wantCountCalls, ruleStore.countCalls)
			assert.Equal(t, tc.wantGroupCalls, ruleStore.groupCountCalls)
		})
	}
}

func restoreUserStatsCache(t *testing.T) {
	t.Helper()

	cache := userStatsCache
	t.Cleanup(func() {
		userStatsCache = cache
	})
}

func newRuleCountStatsService(sqlStore db.DB, ruleStore rules.Store) *sqlStatsService {
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.Enabled = new(bool)

	return &sqlStatsService{
		cfg:       cfg,
		db:        sqlStore,
		orgSvc:    &orgtest.FakeOrgService{},
		ruleStore: ruleStore,
	}
}

func newAlertRule(orgID int64, namespaceUID, group string, paused bool) models.AlertRule {
	return models.RuleGen.With(
		models.RuleMuts.WithOrgID(orgID),
		models.RuleMuts.WithNamespaceUID(namespaceUID),
		models.RuleMuts.WithGroupName(group),
		models.RuleMuts.WithIsPaused(paused),
	).Generate()
}

func insertAlertRules(t *testing.T, store *rules.RuleStore, alertRules []models.AlertRule) {
	t.Helper()

	toInsert := make([]models.InsertRule, len(alertRules))
	for i, rule := range alertRules {
		toInsert[i] = models.InsertRule{AlertRule: rule}
	}

	_, err := store.InsertAlertRules(context.Background(), nil, toInsert)
	require.NoError(t, err)
}

type ruleStoreOverride struct {
	rules.Store

	countErr        error
	groupCountErr   error
	countCalls      []int64
	groupCountCalls []int64
}

func (s *ruleStoreOverride) Count(_ context.Context, orgID int64) (int64, error) {
	s.countCalls = append(s.countCalls, orgID)
	return 0, s.countErr
}

func (s *ruleStoreOverride) CountRuleGroups(_ context.Context, orgID int64) (int64, error) {
	s.groupCountCalls = append(s.groupCountCalls, orgID)
	return 0, s.groupCountErr
}
