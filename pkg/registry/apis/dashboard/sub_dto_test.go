package dashboard

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
)

type denyReadAccessClient struct{}

func (denyReadAccessClient) Check(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: false}, nil
}

func (denyReadAccessClient) Compile(context.Context, authlib.AuthInfo, authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(name, folder string) bool { return false }, authlib.NoopZookie{}, nil
}

func (denyReadAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, c := range req.Checks {
		results[c.CorrelationID] = authlib.BatchCheckResult{Allowed: false}
	}
	return authlib.BatchCheckResponse{Results: results}, nil
}

type fakeGetter struct {
	obj runtime.Object
}

func (f *fakeGetter) Get(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
	return f.obj, nil
}

type capturingResponder struct {
	err error
}

func (c *capturingResponder) Object(int, runtime.Object) {}
func (c *capturingResponder) Error(err error)            { c.err = err }

func TestDTOConnector_DeniedReadReturnsForbidden(t *testing.T) {
	dash := &dashv1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{Name: "dash-1", Namespace: "default"},
	}
	connector, err := NewDTOConnector(
		&fakeGetter{obj: dash},
		nil,
		denyReadAccessClient{},
		func(obj runtime.Object, access *dashboard.DashboardAccess) (runtime.Object, error) {
			return obj, nil
		},
		nil,
	)
	require.NoError(t, err)

	u := &user.SignedInUser{UserID: 1, OrgID: 1, Login: "creator", Namespace: "default"}
	ctx := identity.WithRequester(context.Background(), u)
	ctx = authlib.WithAuthInfo(ctx, u)
	ctx = request.WithNamespace(ctx, "default")

	responder := &capturingResponder{}
	handler, err := connector.(*DTOConnector).Connect(ctx, "dash-1", nil, responder)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/dto", nil)
	req = req.WithContext(ctx)
	handler.ServeHTTP(httptest.NewRecorder(), req)

	require.Error(t, responder.err)
	require.True(t, apierrors.IsForbidden(responder.err), "expected Forbidden, got %v", responder.err)
}
