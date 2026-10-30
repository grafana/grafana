package fakes

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestRuleStore_CountRuleGroups(t *testing.T) {
	store := NewRuleStore(t)
	ctx := context.Background()
	count, err := store.CountRuleGroups(ctx, 0)
	require.NoError(t, err)
	assert.Zero(t, count)
	store.Rules = map[int64][]*models.AlertRule{
		1: {
			{RuleGroup: "shared", NamespaceUID: "folder-a"},
			{RuleGroup: "shared", NamespaceUID: "folder-a"},
			{RuleGroup: "shared", NamespaceUID: "folder-b"},
			{RuleGroup: "first-org-only", NamespaceUID: "folder-a"},
		},
		2: {
			{RuleGroup: "shared", NamespaceUID: "folder-c"},
			{RuleGroup: "second-org-only", NamespaceUID: "folder-c"},
		},
	}
	for _, tc := range []struct {
		name  string
		orgID int64
		want  int64
	}{
		{"global distinct names", 0, 3},
		{"first organization", 1, 2},
		{"second organization", 2, 2},
		{"missing organization", 3, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			count, err := store.CountRuleGroups(ctx, tc.orgID)
			require.NoError(t, err)
			assert.Equal(t, tc.want, count)
		})
	}
	t.Run("hook error", func(t *testing.T) {
		wantErr := errors.New("count unavailable")
		store.Hook = func(query any) error {
			assert.Equal(t, GenericRecordedQuery{Name: "CountRuleGroups", Params: []any{int64(1)}}, query)
			return wantErr
		}
		count, err := store.CountRuleGroups(ctx, 1)
		require.ErrorIs(t, err, wantErr)
		assert.Zero(t, count)
	})
}
