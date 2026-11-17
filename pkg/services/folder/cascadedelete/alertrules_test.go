package cascadedelete

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
)

type fakeRules struct {
	uids  []string
	ns    string
	orgID int64
}

func (f *fakeRules) ListAlertRuleUIDsInFolder(ctx context.Context, orgID int64, _ string) ([]string, error) {
	f.ns, _ = request.NamespaceFrom(ctx)
	f.orgID = orgID
	return f.uids, nil
}

type fakeContents struct {
	ns, folder string
	authorized error
}

func (f *fakeContents) DeleteInFolder(ctx context.Context, namespace, folderUID string, user identity.Requester) error {
	f.ns, f.folder = namespace, folderUID
	f.authorized = folder.RequireUncheckedDeleteAuthorized(ctx, 1, user, []string{folderUID})
	return nil
}

func TestAlertRuleHandler_ListsOneChildWhileTheFolderHasRules(t *testing.T) {
	rules := &fakeRules{uids: []string{"r1", "r2"}}
	h := NewAlertRuleHandler(rules, &fakeContents{})
	require.Equal(t, ChildAlertRule, h.Kind)

	got, total, err := h.Lister.ListChildren(t.Context(), "stacks-7", "a", ChildAlertRule, 0, 10)
	require.NoError(t, err)
	require.Equal(t, []Child{{Kind: ChildAlertRule, Name: "a"}}, got)
	require.Equal(t, int64(1), total)
	require.Equal(t, "stacks-7", rules.ns, "the stack's namespace selects the database")
	require.Equal(t, int64(1), rules.orgID)

	rules.uids = nil
	got, total, err = h.Lister.ListChildren(t.Context(), "stacks-7", "a", ChildAlertRule, 0, 10)
	require.NoError(t, err)
	require.Empty(t, got)
	require.Zero(t, total)
}

func TestAlertRuleHandler_DeletesThroughTheUncheckedCleaner(t *testing.T) {
	contents := &fakeContents{}
	h := NewAlertRuleHandler(&fakeRules{}, contents)

	out, err := h.Deleter.Delete(t.Context(), "stacks-7", "a", Child{Kind: ChildAlertRule, Name: "a"})
	require.NoError(t, err)
	require.Equal(t, DeleteOutcomeDeleted, out)
	require.Equal(t, "stacks-7", contents.ns)
	require.Equal(t, "a", contents.folder)
	require.NoError(t, contents.authorized, "the delete is marked as authorized for this folder")
}

func TestAlertRuleHandler_RejectsAnInvalidNamespace(t *testing.T) {
	h := NewAlertRuleHandler(&fakeRules{}, &fakeContents{})
	_, _, err := h.Lister.ListChildren(t.Context(), "stacks-x", "a", ChildAlertRule, 0, 10)
	require.Error(t, err)
}
