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

func (s *fakeAlertRuleStore) GetAllFoldersWithRules(_ context.Context, orgID int64) (map[string]struct{}, error) {
	out := make(map[string]struct{})
	for _, r := range s.rules[orgID] {
		out[r.NamespaceUID] = struct{}{}
	}
	return out, nil
}

func (s *fakeAlertRuleStore) ListAlertRuleUIDsInFolder(_ context.Context, orgID int64, folderUID string) ([]string, error) {
	var uids []string
	for _, r := range s.rules[orgID] {
		if r.NamespaceUID == folderUID {
			uids = append(uids, r.UID)
		}
	}
	return uids, nil
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
