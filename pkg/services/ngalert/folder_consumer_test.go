package ngalert

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type fakeAlertRuleStore struct {
	rules   map[int64][]*models.AlertRule
	deleted []string
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
	s.deleted = append(s.deleted, ruleUID...)
	return nil
}

func TestAlertRuleFolderConsumer(t *testing.T) {
	store := &fakeAlertRuleStore{rules: map[int64][]*models.AlertRule{
		1: {
			{OrgID: 1, NamespaceUID: "a", UID: "r1"},
			{OrgID: 1, NamespaceUID: "a", UID: "r2"},
			{OrgID: 1, NamespaceUID: "b", UID: "r3"},
		},
	}}
	c := &AlertRuleFolderConsumer{store: store}

	uids, err := c.FoldersInUse(context.Background(), 1)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"a", "b"}, uids)

	require.NoError(t, c.DeleteInFolder(context.Background(), 1, "a"))
	require.ElementsMatch(t, []string{"r1", "r2"}, store.deleted)
}
