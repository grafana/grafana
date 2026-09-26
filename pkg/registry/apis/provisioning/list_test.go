package provisioning

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestListConnectorRejectsUnsupportedRequests(t *testing.T) {
	const base = "/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/repo/resources"
	for _, tc := range []struct {
		method, path string
		code         int
		allow        string
	}{
		{http.MethodPost, base, http.StatusMethodNotAllowed, http.MethodGet},
		{http.MethodPost, base + "/", http.StatusMethodNotAllowed, http.MethodGet},
		{http.MethodGet, base + "/resolve", http.StatusMethodNotAllowed, http.MethodPost},
		{http.MethodPut, base + "/resolve", http.StatusMethodNotAllowed, http.MethodPost},
		{http.MethodDelete, base, http.StatusMethodNotAllowed, http.MethodGet},
		{http.MethodGet, base + "/unknown", http.StatusNotFound, ""},
		{http.MethodPost, base + "/unknown", http.StatusNotFound, ""},
		{http.MethodPost, base + "/resolve/", http.StatusNotFound, ""},
		{http.MethodGet, base + "/resolve/child", http.StatusNotFound, ""},
		{http.MethodPost, base + "/child/resources/resolve", http.StatusNotFound, ""},
		{http.MethodPost, base + "/child%2fresources%2fresolve", http.StatusNotFound, ""},
		{http.MethodPost, base + "//resolve", http.StatusNotFound, ""},
		{http.MethodPost, base + "/%2fresolve", http.StatusNotFound, ""},
		{http.MethodPost, base + "/../resources/resolve", http.StatusNotFound, ""},
		{http.MethodPost, base + "/%2e%2e/resources/resolve", http.StatusNotFound, ""},
		{http.MethodGet, base + "-other", http.StatusNotFound, ""},
		{http.MethodPost, "/repositories/another-repo/resources/resolve", http.StatusBadRequest, ""},
	} {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			connector := NewListConnector(resources.NewMockResourceLister(t), resources.NewMockClientFactory(t), auth.NewMockAccessChecker(t))
			responder := &testResponder{}
			ctx := listTestContext(identity.RoleAdmin)
			handler, err := connector.Connect(ctx, "repo", nil, responder)
			require.NoError(t, err)
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(`{"paths":["cpu.json"]}`)).WithContext(ctx)
			req.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)

			require.Error(t, responder.err)
			var status apierrors.APIStatus
			require.ErrorAs(t, responder.err, &status)
			require.EqualValues(t, tc.code, status.Status().Code)
			require.Equal(t, tc.allow, recorder.Header().Get("Allow"))
			require.Nil(t, responder.object)
			require.Empty(t, recorder.Body.String())
		})
	}
}

func TestListConnectorFullListing(t *testing.T) {
	for _, suffix := range []string{"", "/"} {
		t.Run("suffix="+suffix, func(t *testing.T) {
			listed := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{{Path: "cpu.json", Name: "cpu", Resource: "dashboards", Group: "dashboard.grafana.app"}}}
			lister := resources.NewMockResourceLister(t)
			lister.EXPECT().List(mock.Anything, "default", "repo").Return(listed, nil).Once()
			connector := NewListConnector(lister, resources.NewMockClientFactory(t), auth.NewMockAccessChecker(t))
			responder := &testResponder{}
			ctx := listTestContext(identity.RoleAdmin)
			handler, err := connector.Connect(ctx, "repo", nil, responder)
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodGet, "/repositories/repo/resources"+suffix, nil).WithContext(ctx)
			handler.ServeHTTP(httptest.NewRecorder(), req)

			require.NoError(t, responder.err)
			require.Equal(t, http.StatusOK, responder.statusCode)
			require.Equal(t, listed, responder.object)
		})
	}
}
