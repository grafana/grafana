package annotation

import (
	"context"
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

// fakeAccessClient delegates Check decisions to fn allowing per-request allow/deny control in tests.
type fakeAccessClient struct {
	fn func(req authtypes.CheckRequest) bool
}

func (c *fakeAccessClient) Check(_ context.Context, _ authtypes.AuthInfo, req authtypes.CheckRequest, _ string) (authtypes.CheckResponse, error) {
	return authtypes.CheckResponse{Allowed: c.fn(req)}, nil
}

func (c *fakeAccessClient) Compile(_ context.Context, _ authtypes.AuthInfo, _ authtypes.ListRequest) (authtypes.ItemChecker, authtypes.Zookie, error) {
	return nil, nil, nil
}

func (c *fakeAccessClient) BatchCheck(_ context.Context, _ authtypes.AuthInfo, req authtypes.BatchCheckRequest) (authtypes.BatchCheckResponse, error) {
	results := make(map[string]authtypes.BatchCheckResult, len(req.Checks))
	for _, item := range req.Checks {
		results[item.CorrelationID] = authtypes.BatchCheckResult{
			Allowed: c.fn(authtypes.CheckRequest{
				Verb:        item.Verb,
				Group:       item.Group,
				Resource:    item.Resource,
				Subresource: item.Subresource,
				Namespace:   req.Namespace,
				Name:        item.Name,
			}),
		}
	}
	return authtypes.BatchCheckResponse{Results: results}, nil
}

func TestCanAccessAnnotation(t *testing.T) {
	ns := "org-1"
	dashUID := "dash-abc"

	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	var captured authtypes.CheckRequest
	accessClient := &fakeAccessClient{fn: func(req authtypes.CheckRequest) bool {
		captured = req
		return true
	}}

	t.Run("org annotation", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "org-anno", Namespace: ns},
		}
		allowed, err := canAccessAnnotation(ctx, accessClient, ns, anno, utils.VerbGet)
		require.NoError(t, err)
		require.True(t, allowed)

		assert.Equal(t, "annotation.grafana.app", captured.Group)
		assert.Equal(t, "annotations", captured.Resource)
		assert.Equal(t, "organization", captured.Name)
		assert.Equal(t, ns, captured.Namespace)
		assert.Equal(t, utils.VerbGet, captured.Verb)
		assert.Equal(t, "", captured.Subresource)
	})

	t.Run("dashboard annotation", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "dash-anno", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{DashboardUID: &dashUID},
		}
		allowed, err := canAccessAnnotation(ctx, accessClient, ns, anno, utils.VerbGet)
		require.NoError(t, err)
		require.True(t, allowed)

		assert.Equal(t, "dashboard.grafana.app", captured.Group)
		assert.Equal(t, "dashboards", captured.Resource)
		assert.Equal(t, "annotations", captured.Subresource)
		assert.Equal(t, dashUID, captured.Name)
		assert.Equal(t, ns, captured.Namespace)
		assert.Equal(t, utils.VerbGet, captured.Verb)
	})
}

func TestCanAccessAnnotations(t *testing.T) {
	ns := "org-1"
	dashUID := "dash-abc"

	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	orgAnno := annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{Name: "org-anno", Namespace: ns},
	}
	dashAnno := annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{Name: "dash-anno", Namespace: ns},
		Spec:       annotationV0.AnnotationSpec{DashboardUID: &dashUID},
	}

	t.Run("empty items returns nil", func(t *testing.T) {
		client := &fakeAccessClient{fn: func(_ authtypes.CheckRequest) bool { return true }}
		allowed, err := canAccessAnnotations(ctx, client, ns, nil, utils.VerbList)
		require.NoError(t, err)
		assert.Nil(t, allowed)
	})

	t.Run("all allowed", func(t *testing.T) {
		client := &fakeAccessClient{fn: func(_ authtypes.CheckRequest) bool { return true }}
		allowed, err := canAccessAnnotations(ctx, client, ns, []annotationV0.Annotation{orgAnno, dashAnno}, utils.VerbList)
		require.NoError(t, err)
		assert.Equal(t, []bool{true, true}, allowed)
	})

	t.Run("all denied", func(t *testing.T) {
		client := &fakeAccessClient{fn: func(_ authtypes.CheckRequest) bool { return false }}
		allowed, err := canAccessAnnotations(ctx, client, ns, []annotationV0.Annotation{orgAnno, dashAnno}, utils.VerbList)
		require.NoError(t, err)
		assert.Equal(t, []bool{false, false}, allowed)
	})

	t.Run("mixed - allow org deny dashboard", func(t *testing.T) {
		client := &fakeAccessClient{fn: func(req authtypes.CheckRequest) bool {
			return req.Group == "annotation.grafana.app"
		}}
		allowed, err := canAccessAnnotations(ctx, client, ns, []annotationV0.Annotation{orgAnno, dashAnno}, utils.VerbList)
		require.NoError(t, err)
		assert.Equal(t, []bool{true, false}, allowed)
	})

	t.Run("correct check fields for dashboard annotation", func(t *testing.T) {
		var captured []authtypes.CheckRequest
		client := &fakeAccessClient{fn: func(req authtypes.CheckRequest) bool {
			captured = append(captured, req)
			return true
		}}
		_, err := canAccessAnnotations(ctx, client, ns, []annotationV0.Annotation{dashAnno}, utils.VerbList)
		require.NoError(t, err)
		require.Len(t, captured, 1)
		assert.Equal(t, "dashboard.grafana.app", captured[0].Group)
		assert.Equal(t, "dashboards", captured[0].Resource)
		assert.Equal(t, "annotations", captured[0].Subresource)
		assert.Equal(t, dashUID, captured[0].Name)
		assert.Equal(t, ns, captured[0].Namespace)
		assert.Equal(t, utils.VerbList, captured[0].Verb)
	})

	t.Run("no auth info returns error", func(t *testing.T) {
		ctxNoAuth := k8srequest.WithNamespace(context.Background(), ns)
		client := &fakeAccessClient{fn: func(_ authtypes.CheckRequest) bool { return true }}
		_, err := canAccessAnnotations(ctxNoAuth, client, ns, []annotationV0.Annotation{orgAnno}, utils.VerbList)
		require.Error(t, err)
		assert.True(t, apierrors.IsUnauthorized(err))
	})
}

func TestK8sRESTAdapter_UpdateScopeEscalation(t *testing.T) {
	const ns = "org-1"
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
		accessClient: &fakeAccessClient{fn: func(req authtypes.CheckRequest) bool {
			return req.Group == "annotation.grafana.app"
		}},
	}

	orgAnno.Spec.DashboardUID = &dashUID
	_, _, err = adapter.Update(ctx, orgAnno.Name, registryrest.DefaultUpdatedObjectInfo(orgAnno), nil, nil, false, nil)
	require.Error(t, err)
	assert.True(t, apierrors.IsForbidden(err))
}

func TestK8sRESTAdapter_ListFiltersUnauthorized(t *testing.T) {
	const ns = "org-1"
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
			accessClient: &fakeAccessClient{fn: func(req authtypes.CheckRequest) bool {
				return req.Group == "annotation.grafana.app"
			}},
		}

		obj, err := adapter.List(ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		list := obj.(*annotationV0.AnnotationList)
		require.Len(t, list.Items, 1)
		assert.Equal(t, "org-anno", list.Items[0].Name)
	})

	t.Run("returns all when all allowed", func(t *testing.T) {
		adapter := &k8sRESTAdapter{
			store:        store,
			accessClient: &fakeAccessClient{fn: func(_ authtypes.CheckRequest) bool { return true }},
		}

		obj, err := adapter.List(ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		list := obj.(*annotationV0.AnnotationList)
		assert.Len(t, list.Items, 2)
	})

	t.Run("returns empty when all denied", func(t *testing.T) {
		adapter := &k8sRESTAdapter{
			store:        store,
			accessClient: &fakeAccessClient{fn: func(_ authtypes.CheckRequest) bool { return false }},
		}

		obj, err := adapter.List(ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		list := obj.(*annotationV0.AnnotationList)
		assert.Empty(t, list.Items)
	})
}
