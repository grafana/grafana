package dashboard

import (
	"context"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/admission"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	claims "github.com/grafana/authlib/types"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func lifecycleUser(uid string, role identity.RoleType) context.Context {
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type: claims.TypeUser, UserUID: uid, UserID: 1, OrgID: 1, OrgRole: role,
	})
	return k8srequest.WithNamespace(ctx, "default")
}

func lifecycleDashboard(name string, generation int64, labels, annotations map[string]string) *dashv2.Dashboard {
	return &dashv2.Dashboard{ObjectMeta: metav1.ObjectMeta{
		Name: name, Namespace: "default", Generation: generation, Labels: labels, Annotations: annotations,
	}}
}

func TestMutateDashboardLifecycle(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAssistantDashboardArtifactsDraftsAndForks)
	ctx := lifecycleUser("alice", identity.RoleViewer)
	attrs := func(obj, old runtime.Object, op admission.Operation) admission.Attributes {
		return admission.NewAttributesRecord(obj, old, dashv2.DashboardResourceInfo.GroupVersionKind(), "default", "d1",
			dashv2.DashboardResourceInfo.GroupVersionResource(), "", op, nil, false, nil)
	}

	t.Run("drops forged fork metadata on create", func(t *testing.T) {
		obj := lifecycleDashboard("d1", 0, map[string]string{
			utils.LabelKeyLifecycle: utils.LifecycleFork, utils.LabelKeyLifecycleOwner: "bob", utils.LabelKeyForkOf: "other",
		}, map[string]string{utils.AnnoKeyForkBase: "3"})
		require.NoError(t, mutateDashboardLifecycle(ctx, attrs(obj, nil, admission.Create)))
		require.Empty(t, obj.Labels, "a copy of a fork becomes a regular dashboard")
		require.NotContains(t, obj.Annotations, utils.AnnoKeyForkBase)

		draft := lifecycleDashboard("d1", 0, map[string]string{utils.LabelKeyLifecycle: utils.LifecycleDraft, utils.LabelKeyLifecycleOwner: "bob"}, nil)
		require.NoError(t, mutateDashboardLifecycle(ctx, attrs(draft, nil, admission.Create)))
		require.Equal(t, "alice", draft.Labels[utils.LabelKeyLifecycleOwner], "the owner is always the requester")
	})

	t.Run("stamps the owner of a new draft", func(t *testing.T) {
		obj := lifecycleDashboard("d1", 0, map[string]string{utils.LabelKeyLifecycle: utils.LifecycleDraft}, nil)
		require.NoError(t, mutateDashboardLifecycle(ctx, attrs(obj, nil, admission.Create)))
		require.Equal(t, "alice", obj.Labels[utils.LabelKeyLifecycleOwner])
	})

	t.Run("a regular save can't change lifecycle metadata", func(t *testing.T) {
		old := lifecycleDashboard("d1", 2, map[string]string{
			utils.LabelKeyLifecycle: utils.LifecycleFork, utils.LabelKeyLifecycleOwner: "alice", utils.LabelKeyForkOf: "orig",
		}, map[string]string{utils.AnnoKeyForkBase: "7"})
		obj := lifecycleDashboard("d1", 2, map[string]string{utils.LabelKeyLifecycle: utils.LifecyclePublished}, nil)
		require.NoError(t, mutateDashboardLifecycle(ctx, attrs(obj, old, admission.Update)))
		require.Equal(t, old.Labels, obj.Labels)
		require.Equal(t, "7", obj.Annotations[utils.AnnoKeyForkBase])
	})
}

// getOnlyStorage serves Get from a fixed set of objects; the guard tests need nothing else.
type getOnlyStorage struct {
	grafanarest.Storage
	objects map[string]runtime.Object
}

func (s *getOnlyStorage) Get(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	if obj, ok := s.objects[name]; ok {
		return obj.DeepCopyObject(), nil
	}
	return nil, apierrors.NewNotFound(dashv2.DashboardResourceInfo.GroupResource(), name)
}

func TestLifecycleGuardHidesDraftsFromOtherUsers(t *testing.T) {
	store := &getOnlyStorage{objects: map[string]runtime.Object{
		"draft": lifecycleDashboard("draft", 1, map[string]string{
			utils.LabelKeyLifecycle: utils.LifecycleDraft, utils.LabelKeyLifecycleOwner: "alice",
		}, nil),
	}}
	guard := newLifecycleGuard(store, dashv2.DashboardResourceInfo.GroupResource())

	_, err := guard.Get(lifecycleUser("alice", identity.RoleViewer), "draft", &metav1.GetOptions{})
	require.NoError(t, err, "owner reads their draft")
	_, err = guard.Get(lifecycleUser("bob", identity.RoleEditor), "draft", &metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "another user doesn't see it")
	_, err = guard.Get(lifecycleUser("carol", identity.RoleAdmin), "draft", &metav1.GetOptions{})
	require.NoError(t, err, "org admins see it")
}

func TestLifecycleSearchRequirements(t *testing.T) {
	user := &identity.StaticRequester{Type: claims.TypeUser, UserUID: "alice"}

	reqs := lifecycleSearchRequirements(url.Values{}, user)
	require.Len(t, reqs, 1)
	require.Equal(t, utils.LabelKeyLifecycle, reqs[0].Key)
	require.Equal(t, string(selection.NotIn), reqs[0].Operator)

	reqs = lifecycleSearchRequirements(url.Values{"forkOf": {"orig"}}, user)
	require.ElementsMatch(t, []string{utils.LabelKeyLifecycle, utils.LabelKeyLifecycleOwner, utils.LabelKeyForkOf},
		[]string{reqs[0].Key, reqs[1].Key, reqs[2].Key})
	require.Equal(t, []string{"alice"}, reqs[1].Values, "only the requester's own forks")
}

func TestMergeRefusesWhenOriginalMoved(t *testing.T) {
	store := &getOnlyStorage{objects: map[string]runtime.Object{
		"fork": lifecycleDashboard("fork", 3, map[string]string{
			utils.LabelKeyLifecycle: utils.LifecycleFork, utils.LabelKeyLifecycleOwner: "alice", utils.LabelKeyForkOf: "orig",
		}, map[string]string{utils.AnnoKeyForkBase: "12"}),
		"orig": lifecycleDashboard("orig", 14, nil, nil),
	}}
	c := &lifecycleConnector{store: newLifecycleGuard(store, dashv2.DashboardResourceInfo.GroupResource()), resource: dashv2.DashboardResourceInfo.GroupResource(), op: lifecycleMerge}

	_, err := c.merge(lifecycleUser("alice", identity.RoleEditor), "fork", lifecycleRequest{})
	require.True(t, apierrors.IsConflict(err), err)
	status := err.(apierrors.APIStatus).Status()
	require.Contains(t, status.Details.Causes, metav1.StatusCause{Type: "currentGeneration", Message: "14"})
}
