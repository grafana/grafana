package folderlabelsyncer

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func set(uids ...string) map[string]struct{} {
	s := make(map[string]struct{}, len(uids))
	for _, uid := range uids {
		s[uid] = struct{}{}
	}
	return s
}

func TestDiffFolderKeys(t *testing.T) {
	tests := []struct {
		name      string
		withRules map[string]struct{}
		labeled   map[string]struct{}
		expected  []models.FolderKey
	}{
		{
			name:      "holds rules but unlabelled: needs the label added",
			withRules: set("a"),
			labeled:   set(),
			expected:  []models.FolderKey{{OrgID: 1, UID: "a"}},
		},
		{
			name:      "labelled but holds no rules: needs the label removed",
			withRules: set(),
			labeled:   set("a"),
			expected:  []models.FolderKey{{OrgID: 1, UID: "a"}},
		},
		{
			name:      "already agrees: left alone",
			withRules: set("a", "b"),
			labeled:   set("a", "b"),
			expected:  nil,
		},
		{
			name:      "both directions at once, with an agreeing folder excluded",
			withRules: set("a", "b"),
			labeled:   set("b", "c"),
			expected:  []models.FolderKey{{OrgID: 1, UID: "a"}, {OrgID: 1, UID: "c"}},
		},
		{
			name:      "empty org has nothing to do",
			withRules: set(),
			labeled:   set(),
			expected:  nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.ElementsMatch(t, tc.expected, diffFolderKeys(1, tc.withRules, tc.labeled))
		})
	}
}

func TestIntegrationFoldersWithRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)

	ruleStore := &store.DBstore{
		SQLStore:       sqlStore,
		Cfg:            setting.UnifiedAlertingSettings{BaseInterval: time.Second * 10},
		Logger:         log.NewNopLogger(),
		FeatureToggles: featuremgmt.WithFeatures(),
	}
	gen := models.RuleGen
	gen = gen.With(gen.WithIntervalMatching(ruleStore.Cfg.BaseInterval))

	insertRule := func(t *testing.T, orgID int64, namespaceUID string) {
		t.Helper()
		rule := gen.With(gen.WithOrgID(orgID), gen.WithNamespaceUID(namespaceUID)).Generate()
		_, err := ruleStore.InsertAlertRules(context.Background(), &models.AlertingUserUID,
			[]models.InsertRule{{AlertRule: rule}})
		require.NoError(t, err)
	}

	insertRule(t, 1, "folder-a")
	insertRule(t, 1, "folder-a")
	insertRule(t, 1, "folder-b")
	insertRule(t, 1, "")
	insertRule(t, 2, "folder-other")

	t.Run("returns the deduplicated folders holding rules, scoped to the org", func(t *testing.T) {
		got, err := foldersWithRules(context.Background(), sqlStore, 1)
		require.NoError(t, err)
		require.Equal(t, set("folder-a", "folder-b"), got)
	})

	t.Run("does not see other orgs' folders", func(t *testing.T) {
		got, err := foldersWithRules(context.Background(), sqlStore, 2)
		require.NoError(t, err)
		require.Equal(t, set("folder-other"), got)
	})

	t.Run("returns empty for an org with no rules", func(t *testing.T) {
		got, err := foldersWithRules(context.Background(), sqlStore, 99)
		require.NoError(t, err)
		require.Empty(t, got)
	})
}
