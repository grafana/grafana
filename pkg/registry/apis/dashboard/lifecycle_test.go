package dashboard

import (
	"context"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/admission"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

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
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDashboardDrafts)
	ctx := lifecycleUser("alice", identity.RoleViewer)
	attrs := func(obj, old runtime.Object, op admission.Operation) admission.Attributes {
		return admission.NewAttributesRecord(obj, old, dashv2.DashboardResourceInfo.GroupVersionKind(), "default", "d1",
			dashv2.DashboardResourceInfo.GroupVersionResource(), "", op, nil, false, nil)
	}

	t.Run("drops a forged owner on create", func(t *testing.T) {
		obj := lifecycleDashboard("d1", 0, map[string]string{utils.LabelKeyLifecycleOwner: "bob"}, nil)
		require.NoError(t, mutateDashboardLifecycle(ctx, attrs(obj, nil, admission.Create)))
		require.Empty(t, obj.Labels, "a regular dashboard has no owner")

		draft := lifecycleDashboard("d1", 0, map[string]string{utils.LabelKeyLifecycle: utils.LifecycleDraft, utils.LabelKeyLifecycleOwner: "bob"}, nil)
		require.NoError(t, mutateDashboardLifecycle(ctx, attrs(draft, nil, admission.Create)))
		require.Equal(t, "alice", draft.Labels[utils.LabelKeyLifecycleOwner], "the owner is always the requester")
	})

	t.Run("stamps the owner of a new draft", func(t *testing.T) {
		obj := lifecycleDashboard("d1", 0, map[string]string{utils.LabelKeyLifecycle: utils.LifecycleDraft}, nil)
		require.NoError(t, mutateDashboardLifecycle(ctx, attrs(obj, nil, admission.Create)))
		require.Equal(t, "alice", obj.Labels[utils.LabelKeyLifecycleOwner])
	})

	t.Run("a regular save can't publish a draft or change its owner", func(t *testing.T) {
		old := lifecycleDashboard("d1", 2, map[string]string{
			utils.LabelKeyLifecycle: utils.LifecycleDraft, utils.LabelKeyLifecycleOwner: "alice",
		}, nil)
		obj := lifecycleDashboard("d1", 2, map[string]string{utils.LabelKeyLifecycle: utils.LifecyclePublished, utils.LabelKeyLifecycleOwner: "bob"}, nil)
		require.NoError(t, mutateDashboardLifecycle(ctx, attrs(obj, old, admission.Update)))
		require.Equal(t, old.Labels, obj.Labels)
	})
}

// getOnlyStorage serves Get from a fixed set of objects, and Watch from a fake
// watcher; the guard tests need nothing else.
type getOnlyStorage struct {
	grafanarest.Storage
	objects map[string]runtime.Object
	getErr  error
	updated []string
	watcher *watch.FakeWatcher
}

func (s *getOnlyStorage) Get(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	if s.getErr != nil {
		return nil, s.getErr
	}
	if obj, ok := s.objects[name]; ok {
		return obj.DeepCopyObject(), nil
	}
	return nil, apierrors.NewNotFound(dashv2.DashboardResourceInfo.GroupResource(), name)
}

func (s *getOnlyStorage) Update(_ context.Context, name string, _ rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	s.updated = append(s.updated, name)
	return nil, false, nil
}

func (s *getOnlyStorage) Watch(context.Context, *metainternalversion.ListOptions) (watch.Interface, error) {
	return s.watcher, nil
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

func TestLifecycleGuardRefusesWritesItCantCheck(t *testing.T) {
	store := &getOnlyStorage{getErr: apierrors.NewServiceUnavailable("storage is down")}
	guard := newLifecycleGuard(store, dashv2.DashboardResourceInfo.GroupResource())
	_, _, err := guard.Update(lifecycleUser("bob", identity.RoleEditor), "draft", nil, nil, nil, false, &metav1.UpdateOptions{})
	require.True(t, apierrors.IsServiceUnavailable(err))
	require.Empty(t, store.updated, "a write the guard couldn't check never reaches storage")

	store.getErr = nil
	_, _, err = guard.Update(lifecycleUser("bob", identity.RoleEditor), "new", nil, nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err, "a dashboard that doesn't exist yet is left to storage")
	require.Equal(t, []string{"new"}, store.updated)
}

func TestLifecycleGuardWatchHidesDraftsFromOtherUsers(t *testing.T) {
	store := &getOnlyStorage{watcher: watch.NewFakeWithChanSize(3, false)}
	guard := newLifecycleGuard(store, dashv2.DashboardResourceInfo.GroupResource())
	events, err := guard.(rest.Watcher).Watch(lifecycleUser("bob", identity.RoleEditor), &metainternalversion.ListOptions{})
	require.NoError(t, err)
	defer events.Stop()

	store.watcher.Add(lifecycleDashboard("alices-draft", 1, map[string]string{
		utils.LabelKeyLifecycle: utils.LifecycleDraft, utils.LabelKeyLifecycleOwner: "alice",
	}, nil))
	store.watcher.Add(lifecycleDashboard("published", 1, nil, nil))
	event := <-events.ResultChan()
	require.Equal(t, "published", event.Object.(*dashv2.Dashboard).Name, "another user's draft is filtered out")
}

func TestLifecycleSearchRequirements(t *testing.T) {
	user := &identity.StaticRequester{Type: claims.TypeUser, UserUID: "alice"}

	reqs := lifecycleSearchRequirements(url.Values{}, user)
	require.Len(t, reqs, 1)
	require.Equal(t, utils.LabelKeyLifecycle, reqs[0].Key)
	require.Equal(t, string(selection.NotIn), reqs[0].Operator)

	reqs = lifecycleSearchRequirements(url.Values{"lifecycle": {"draft"}}, user)
	require.ElementsMatch(t, []string{utils.LabelKeyLifecycle, utils.LabelKeyLifecycleOwner}, []string{reqs[0].Key, reqs[1].Key})
	require.Equal(t, []string{"alice"}, reqs[1].Values, "only the requester's own drafts")
}

func TestUnknownLifecycleStaysPrivate(t *testing.T) {
	store := &getOnlyStorage{objects: map[string]runtime.Object{
		"old": lifecycleDashboard("old", 1, map[string]string{
			utils.LabelKeyLifecycle: "retired-value", utils.LabelKeyLifecycleOwner: "alice",
		}, nil),
	}}
	guard := newLifecycleGuard(store, dashv2.DashboardResourceInfo.GroupResource())
	_, err := guard.Get(lifecycleUser("bob", identity.RoleEditor), "old", &metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "a value this server doesn't know is never shown to others")
}
