package annotation

import (
	"context"
	"testing"

	authtypes "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	registryrest "k8s.io/apiserver/pkg/registry/rest"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
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

func (c *fakeAccessClient) BatchCheck(_ context.Context, _ authtypes.AuthInfo, _ authtypes.BatchCheckRequest) (authtypes.BatchCheckResponse, error) {
	return authtypes.BatchCheckResponse{}, nil
}

func TestCanAccessAnnotation(t *testing.T) {
	ns := "org-1"
	dashUID := "dash-abc"

	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	tests := []struct {
		desc              string
		anno              *annotationV0.Annotation
		expectedGroup     string
		expectedName      string
		expectedNamespace string
	}{
		{
			desc: "org annotation uses annotation.grafana.app/organization scope",
			anno: &annotationV0.Annotation{
				ObjectMeta: metav1.ObjectMeta{Name: "org-anno", Namespace: ns},
			},
			expectedGroup:     "annotation.grafana.app",
			expectedName:      "organization",
			expectedNamespace: ns,
		},
		{
			desc: "dashboard annotation uses dashboard.grafana.app/<dashUID> scope",
			anno: &annotationV0.Annotation{
				ObjectMeta: metav1.ObjectMeta{Name: "dash-anno", Namespace: ns},
				Spec:       annotationV0.AnnotationSpec{DashboardUID: &dashUID},
			},
			expectedGroup:     "dashboard.grafana.app",
			expectedName:      dashUID,
			expectedNamespace: ns,
		},
	}

	for _, tc := range tests {
		t.Run(tc.desc, func(t *testing.T) {
			var captured authtypes.CheckRequest
			accessClient := &fakeAccessClient{fn: func(req authtypes.CheckRequest) bool {
				captured = req
				return true
			}}

			allowed, err := canAccessAnnotation(ctx, accessClient, ns, tc.anno, utils.VerbGet)
			require.NoError(t, err)
			require.True(t, allowed)

			assert.Equal(t, tc.expectedGroup, captured.Group)
			assert.Equal(t, "annotations", captured.Resource)
			assert.Equal(t, tc.expectedName, captured.Name)
			assert.Equal(t, tc.expectedNamespace, captured.Namespace)
		})
	}
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
		store:  store,
		mapper: request.GetNamespaceMapper(&setting.Cfg{}),
		accessClient: &fakeAccessClient{fn: func(req authtypes.CheckRequest) bool {
			return req.Group == "annotation.grafana.app"
		}},
	}

	orgAnno.Spec.DashboardUID = &dashUID
	_, _, err = adapter.Update(ctx, orgAnno.Name, registryrest.DefaultUpdatedObjectInfo(orgAnno), nil, nil, false, nil)
	require.Error(t, err)
	assert.True(t, apierrors.IsForbidden(err))
}
