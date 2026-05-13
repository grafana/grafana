package annotation

import (
	"context"
	"fmt"
	"testing"

	authtypes "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	registryrest "k8s.io/apiserver/pkg/registry/rest"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// fakeAccessClient delegates allow/deny to fn. Single Check is synthesized into a BatchCheckItem
// so tests can assert on item.Folder.
type fakeAccessClient struct {
	fn        func(item authtypes.BatchCheckItem) bool
	namespace string
}

func (c *fakeAccessClient) Check(_ context.Context, _ authtypes.AuthInfo, req authtypes.CheckRequest, _ string) (authtypes.CheckResponse, error) {
	c.namespace = req.Namespace
	return authtypes.CheckResponse{Allowed: c.fn(authtypes.BatchCheckItem{
		Verb:        req.Verb,
		Group:       req.Group,
		Resource:    req.Resource,
		Subresource: req.Subresource,
		Name:        req.Name,
	})}, nil
}

func (c *fakeAccessClient) Compile(_ context.Context, _ authtypes.AuthInfo, _ authtypes.ListRequest) (authtypes.ItemChecker, authtypes.Zookie, error) {
	return nil, nil, nil
}

func (c *fakeAccessClient) BatchCheck(_ context.Context, _ authtypes.AuthInfo, req authtypes.BatchCheckRequest) (authtypes.BatchCheckResponse, error) {
	c.namespace = req.Namespace
	results := make(map[string]authtypes.BatchCheckResult, len(req.Checks))
	for _, item := range req.Checks {
		results[item.CorrelationID] = authtypes.BatchCheckResult{Allowed: c.fn(item)}
	}
	return authtypes.BatchCheckResponse{Results: results}, nil
}

// fakeFolderResolver returns folders[uid]
type fakeFolderResolver struct {
	folders map[string]string
	err     error
	calls   map[string]int
}

func newFakeFolderResolver(folders map[string]string) *fakeFolderResolver {
	return &fakeFolderResolver{folders: folders, calls: map[string]int{}}
}

func (f *fakeFolderResolver) ResolveFolder(_ context.Context, _ string, dashboardUID string) (string, error) {
	f.calls[dashboardUID]++
	if f.err != nil {
		return "", f.err
	}
	return f.folders[dashboardUID], nil
}

func TestCanAccessAnnotation(t *testing.T) {
	ns := "default"
	dashUID := "dash-abc"
	folderUID := "folder-xyz"

	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	var captured authtypes.BatchCheckItem
	accessClient := &fakeAccessClient{fn: func(item authtypes.BatchCheckItem) bool {
		captured = item
		return true
	}}
	dashClient := newFakeFolderResolver(map[string]string{dashUID: folderUID})

	t.Run("org annotation - no dashboard lookup", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "org-anno", Namespace: ns},
		}
		allowed, err := canAccessAnnotation(ctx, accessClient, dashClient, ns, anno, utils.VerbGet)
		require.NoError(t, err)
		require.True(t, allowed)

		assert.Equal(t, "annotation.grafana.app", captured.Group)
		assert.Equal(t, "annotations", captured.Resource)
		assert.Equal(t, "organization", captured.Name)
		assert.Equal(t, ns, accessClient.namespace)
		assert.Equal(t, utils.VerbGet, captured.Verb)
		assert.Equal(t, "", captured.Subresource)
		assert.Equal(t, "", captured.Folder)
		assert.Equal(t, 0, dashClient.calls[dashUID], "dashboard lookup must not run for org annotations")
	})

	t.Run("dashboard annotation - folder resolved", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "dash-anno", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{DashboardUID: &dashUID},
		}
		allowed, err := canAccessAnnotation(ctx, accessClient, dashClient, ns, anno, utils.VerbGet)
		require.NoError(t, err)
		require.True(t, allowed)

		assert.Equal(t, "dashboard.grafana.app", captured.Group)
		assert.Equal(t, "dashboards", captured.Resource)
		assert.Equal(t, "annotations", captured.Subresource)
		assert.Equal(t, dashUID, captured.Name)
		assert.Equal(t, ns, accessClient.namespace)
		assert.Equal(t, utils.VerbGet, captured.Verb)
		assert.Equal(t, folderUID, captured.Folder, "folder must be propagated for inheritance checks")
	})

	t.Run("dashboard annotation - missing dashboard returns empty folder", func(t *testing.T) {
		missing := "gone"
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "orphan", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{DashboardUID: &missing},
		}
		allowed, err := canAccessAnnotation(ctx, accessClient, dashClient, ns, anno, utils.VerbGet)
		require.NoError(t, err)
		require.True(t, allowed)
		assert.Equal(t, "", captured.Folder)
	})

	t.Run("dashboard annotation - lookup error returned", func(t *testing.T) {
		errClient := &fakeFolderResolver{err: fmt.Errorf("boom"), calls: map[string]int{}}
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "dash-anno", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{DashboardUID: &dashUID},
		}
		_, err := canAccessAnnotation(ctx, accessClient, errClient, ns, anno, utils.VerbGet)
		require.Error(t, err)
	})
}

func TestCanAccessAnnotations(t *testing.T) {
	ns := "default"
	dashUID := "dash-abc"
	otherDashUID := "dash-other"
	folderUID := "folder-xyz"

	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	orgAnno := annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{Name: "org-anno", Namespace: ns},
	}
	dashAnno := annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{Name: "dash-anno", Namespace: ns},
		Spec:       annotationV0.AnnotationSpec{DashboardUID: &dashUID},
	}
	dashAnno2 := annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{Name: "dash-anno-2", Namespace: ns},
		Spec:       annotationV0.AnnotationSpec{DashboardUID: &dashUID},
	}
	otherDashAnno := annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{Name: "other-dash-anno", Namespace: ns},
		Spec:       annotationV0.AnnotationSpec{DashboardUID: &otherDashUID},
	}

	t.Run("empty items returns nil", func(t *testing.T) {
		client := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}
		dashClient := newFakeFolderResolver(nil)
		allowed, err := canAccessAnnotations(ctx, client, dashClient, ns, nil, utils.VerbList)
		require.NoError(t, err)
		assert.Nil(t, allowed)
	})

	t.Run("all allowed", func(t *testing.T) {
		client := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}
		dashClient := newFakeFolderResolver(map[string]string{dashUID: folderUID})
		allowed, err := canAccessAnnotations(ctx, client, dashClient, ns, []annotationV0.Annotation{orgAnno, dashAnno}, utils.VerbList)
		require.NoError(t, err)
		assert.Equal(t, []bool{true, true}, allowed)
	})

	t.Run("all denied", func(t *testing.T) {
		client := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return false }}
		dashClient := newFakeFolderResolver(map[string]string{dashUID: folderUID})
		allowed, err := canAccessAnnotations(ctx, client, dashClient, ns, []annotationV0.Annotation{orgAnno, dashAnno}, utils.VerbList)
		require.NoError(t, err)
		assert.Equal(t, []bool{false, false}, allowed)
	})

	t.Run("mixed - allow org deny dashboard", func(t *testing.T) {
		client := &fakeAccessClient{fn: func(req authtypes.BatchCheckItem) bool {
			return req.Group == "annotation.grafana.app"
		}}
		dashClient := newFakeFolderResolver(map[string]string{dashUID: folderUID})
		allowed, err := canAccessAnnotations(ctx, client, dashClient, ns, []annotationV0.Annotation{orgAnno, dashAnno}, utils.VerbList)
		require.NoError(t, err)
		assert.Equal(t, []bool{true, false}, allowed)
	})

	t.Run("inherited folder permission allows access", func(t *testing.T) {
		// Caller has annotation perm at folder scope, not dashboard. Folder must be forwarded.
		client := &fakeAccessClient{fn: func(req authtypes.BatchCheckItem) bool {
			return req.Group == "dashboard.grafana.app" && req.Folder == folderUID
		}}
		dashClient := newFakeFolderResolver(map[string]string{dashUID: folderUID})
		allowed, err := canAccessAnnotations(ctx, client, dashClient, ns, []annotationV0.Annotation{dashAnno}, utils.VerbList)
		require.NoError(t, err)
		assert.Equal(t, []bool{true}, allowed)
	})

	t.Run("correct check fields for dashboard annotation", func(t *testing.T) {
		var captured []authtypes.BatchCheckItem
		client := &fakeAccessClient{fn: func(req authtypes.BatchCheckItem) bool {
			captured = append(captured, req)
			return true
		}}
		dashClient := newFakeFolderResolver(map[string]string{dashUID: folderUID})
		_, err := canAccessAnnotations(ctx, client, dashClient, ns, []annotationV0.Annotation{dashAnno}, utils.VerbList)
		require.NoError(t, err)
		require.Len(t, captured, 1)
		assert.Equal(t, "dashboard.grafana.app", captured[0].Group)
		assert.Equal(t, "dashboards", captured[0].Resource)
		assert.Equal(t, "annotations", captured[0].Subresource)
		assert.Equal(t, dashUID, captured[0].Name)
		assert.Equal(t, utils.VerbList, captured[0].Verb)
		assert.Equal(t, folderUID, captured[0].Folder)
	})

	t.Run("dashboard lookup deduped within batch", func(t *testing.T) {
		client := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}
		dashClient := newFakeFolderResolver(map[string]string{dashUID: folderUID, otherDashUID: ""})
		_, err := canAccessAnnotations(ctx, client, dashClient, ns, []annotationV0.Annotation{dashAnno, dashAnno2, otherDashAnno, orgAnno}, utils.VerbList)
		require.NoError(t, err)
		assert.Equal(t, 1, dashClient.calls[dashUID], "duplicate dashboard UIDs in batch should be looked up once")
		assert.Equal(t, 1, dashClient.calls[otherDashUID])
	})

	t.Run("no auth info returns error", func(t *testing.T) {
		ctxNoAuth := k8srequest.WithNamespace(context.Background(), ns)
		client := &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }}
		dashClient := newFakeFolderResolver(nil)
		_, err := canAccessAnnotations(ctxNoAuth, client, dashClient, ns, []annotationV0.Annotation{orgAnno}, utils.VerbList)
		require.Error(t, err)
		assert.True(t, apierrors.IsUnauthorized(err))
	})
}

func TestK8sRESTAdapter_UpdateScopeEscalation(t *testing.T) {
	const ns = "default"
	dashUID := "dash-abc"

	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	orgAnno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{Name: "org-anno", Namespace: ns},
	}

	store := NewMemoryStore()
	_, err := store.Create(ctx, orgAnno)
	require.NoError(t, err)

	// Allow writes on org annotations (annotation.grafana.app) but deny on dashboard scope.
	// The update attempts to move an org annotation onto a dashboard the caller cannot write.
	adapter := &k8sRESTAdapter{
		store: store,
		accessClient: &fakeAccessClient{fn: func(req authtypes.BatchCheckItem) bool {
			return req.Group == "annotation.grafana.app"
		}},
		folderResolver: newFakeFolderResolver(map[string]string{dashUID: ""}),
	}

	orgAnno.Spec.DashboardUID = &dashUID
	_, _, err = adapter.Update(ctx, orgAnno.Name, registryrest.DefaultUpdatedObjectInfo(orgAnno), nil, nil, false, nil)
	require.Error(t, err)
	assert.True(t, apierrors.IsForbidden(err))
}

func TestK8sRESTAdapter_ListFiltersUnauthorized(t *testing.T) {
	const ns = "default"
	dashUID := "dash-abc"

	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	store := NewMemoryStore()
	orgAnno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{Name: "org-anno", Namespace: ns},
	}
	dashAnno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{Name: "dash-anno", Namespace: ns},
		Spec:       annotationV0.AnnotationSpec{DashboardUID: &dashUID},
	}
	_, err := store.Create(ctx, orgAnno)
	require.NoError(t, err)
	_, err = store.Create(ctx, dashAnno)
	require.NoError(t, err)

	t.Run("filters out denied annotations", func(t *testing.T) {
		adapter := &k8sRESTAdapter{
			store: store,
			accessClient: &fakeAccessClient{fn: func(req authtypes.BatchCheckItem) bool {
				return req.Group == "annotation.grafana.app"
			}},
			folderResolver: newFakeFolderResolver(map[string]string{dashUID: ""}),
		}

		obj, err := adapter.List(ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		list := obj.(*annotationV0.AnnotationList)
		require.Len(t, list.Items, 1)
		assert.Equal(t, "org-anno", list.Items[0].Name)
	})

	t.Run("returns all when all allowed", func(t *testing.T) {
		adapter := &k8sRESTAdapter{
			store:          store,
			accessClient:   &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return true }},
			folderResolver: newFakeFolderResolver(map[string]string{dashUID: ""}),
		}

		obj, err := adapter.List(ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		list := obj.(*annotationV0.AnnotationList)
		assert.Len(t, list.Items, 2)
	})

	t.Run("returns empty when all denied", func(t *testing.T) {
		adapter := &k8sRESTAdapter{
			store:          store,
			accessClient:   &fakeAccessClient{fn: func(_ authtypes.BatchCheckItem) bool { return false }},
			folderResolver: newFakeFolderResolver(map[string]string{dashUID: ""}),
		}

		obj, err := adapter.List(ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		list := obj.(*annotationV0.AnnotationList)
		assert.Empty(t, list.Items)
	})
}
