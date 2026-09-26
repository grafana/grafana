package ngalert

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type fakeAlertRuleStore struct {
	rules     map[int64][]*models.AlertRule
	deleted   []string
	deleteErr error
}

func (s *fakeAlertRuleStore) ListAlertRules(_ context.Context, q *models.ListAlertRulesQuery) (models.RulesGroup, error) {
	if len(q.NamespaceUIDs) == 0 {
		return s.rules[q.OrgID], nil
	}
	want := map[string]bool{}
	for _, uid := range q.NamespaceUIDs {
		want[uid] = true
	}
	var out models.RulesGroup
	for _, r := range s.rules[q.OrgID] {
		if want[r.NamespaceUID] {
			out = append(out, r)
		}
	}
	return out, nil
}

func (s *fakeAlertRuleStore) DeleteAlertRulesByUID(_ context.Context, _ int64, _ *models.UserUID, _ bool, ruleUID ...string) error {
	if s.deleteErr != nil {
		return s.deleteErr
	}
	s.deleted = append(s.deleted, ruleUID...)
	return nil
}

// logCtxValue looks up a key in the alternating key/value slice a log.Logger call receives.
func logCtxValue(t *testing.T, ctx []any, key string) any {
	t.Helper()
	for i := 0; i+1 < len(ctx); i += 2 {
		if ctx[i] == key {
			return ctx[i+1]
		}
	}
	t.Fatalf("key %q not found in log context %v", key, ctx)
	return nil
}

func TestAlertRuleFolderConsumer(t *testing.T) {
	store := &fakeAlertRuleStore{rules: map[int64][]*models.AlertRule{
		1: {
			{OrgID: 1, NamespaceUID: "a", UID: "r1", Title: "CPU alert"},
			{OrgID: 1, NamespaceUID: "a", UID: "r2", Title: "Memory alert"},
			{OrgID: 1, NamespaceUID: "b", UID: "r3", Title: "Disk alert"},
		},
	}}
	fakeLog := &logtest.Fake{}
	c := &AlertRuleFolderConsumer{store: store, log: fakeLog}

	uids, err := c.FoldersInUse(context.Background(), 1)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"a", "b"}, uids)

	require.NoError(t, c.DeleteInFolder(context.Background(), 1, "a"))
	require.ElementsMatch(t, []string{"r1", "r2"}, store.deleted)

	require.Equal(t, 1, fakeLog.InfoLogs.Calls)
	require.Equal(t, "Deleted alert rules in deleted folder", fakeLog.InfoLogs.Message)
	require.ElementsMatch(t, []string{"r1 (CPU alert)", "r2 (Memory alert)"}, logCtxValue(t, fakeLog.InfoLogs.Ctx, "rules"))
	require.Equal(t, 2, logCtxValue(t, fakeLog.InfoLogs.Ctx, "count"))
	require.Equal(t, "a", logCtxValue(t, fakeLog.InfoLogs.Ctx, "folder_uid"))
}

func TestAlertRuleFolderConsumer_NoRulesToDelete_DoesNotLog(t *testing.T) {
	store := &fakeAlertRuleStore{rules: map[int64][]*models.AlertRule{}}
	fakeLog := &logtest.Fake{}
	c := &AlertRuleFolderConsumer{store: store, log: fakeLog}

	require.NoError(t, c.DeleteInFolder(context.Background(), 1, "a"))
	require.Equal(t, 0, fakeLog.InfoLogs.Calls)
}

func TestAlertRuleFolderConsumer_DeleteError_DoesNotLog(t *testing.T) {
	store := &fakeAlertRuleStore{
		rules: map[int64][]*models.AlertRule{
			1: {{OrgID: 1, NamespaceUID: "a", UID: "r1", Title: "CPU alert"}},
		},
		deleteErr: errors.New("boom"),
	}
	fakeLog := &logtest.Fake{}
	c := &AlertRuleFolderConsumer{store: store, log: fakeLog}

	err := c.DeleteInFolder(context.Background(), 1, "a")
	require.ErrorIs(t, err, store.deleteErr)
	require.Equal(t, 0, fakeLog.InfoLogs.Calls)
}
