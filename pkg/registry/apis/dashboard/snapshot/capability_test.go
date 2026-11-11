package snapshot

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/common"

	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestDeleteKeyPreservesExternalSnapshotOnRemoteFailure(t *testing.T) {
	for _, kubernetesPush := range []bool{false, true} {
		t.Run(map[bool]string{false: "legacy", true: "kubernetes"}[kubernetesPush], func(t *testing.T) {
			setExternalSnapshotsK8SAPIPushToggle(t, kubernetesPush)
			var remoteDeleted atomic.Bool
			var remoteStatus atomic.Int32
			remoteStatus.Store(http.StatusInternalServerError)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				status := int(remoteStatus.Load())
				remoteDeleted.Store(status == http.StatusOK)
				w.WriteHeader(status)
			}))
			t.Cleanup(server.Close)
			snap := dashv0.Snapshot{}
			snap.Name = "snapshot"
			snap.Namespace = "default"
			snap.Spec.External = new(true)
			snap.Spec.DeleteKey = new("delete-key")
			storage := grafanarest.NewMockStorage(t)
			storage.On("List", mock.Anything, mock.Anything).Return(&dashv0.SnapshotList{Items: []dashv0.Snapshot{snap}}, nil)
			storage.On("Delete", mock.Anything, snap.Name, mock.Anything, mock.Anything).
				Run(func(mock.Arguments) { require.True(t, remoteDeleted.Load()) }).Return(&snap, true, nil).Once()
			routes := GetRoutes(dashv0.SnapshotSharingOptions{SnapshotsEnabled: true, ExternalSnapshotURL: server.URL},
				acmock.New().WithPermissions([]ac.Permission{{Action: dashboards.ActionSnapshotsDelete}}),
				map[string]common.OpenAPIDefinition{}, func() rest.Storage { return storage }, dashboards.NewFakeDashboardService(t), nil, testReadFromLegacy)
			request := func() *httptest.ResponseRecorder {
				req := httptest.NewRequest(http.MethodDelete, "/snapshots/delete/delete-key", nil)
				req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{OrgID: 1, UserID: 1}))
				req = mux.SetURLVars(req, map[string]string{"namespace": "default", "deleteKey": "delete-key"})
				rsp := httptest.NewRecorder()
				routes.Namespace[1].Handler(rsp, req)
				return rsp
			}
			failed := request()
			require.GreaterOrEqual(t, failed.Code, http.StatusBadRequest, failed.Body.String())
			storage.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			remoteStatus.Store(http.StatusOK)
			retried := request()
			require.Equal(t, http.StatusOK, retried.Code, retried.Body.String())
		})
	}
}

func TestDeleteKeyCapabilityCannotAuthorizeArbitraryDeletes(t *testing.T) {
	setKubernetesSnapshotsToggle(t, true)
	for _, tc := range []struct{ name, requestNamespace, storedNamespace, storedKey string }{
		{"wrong key returned by storage", authlib.OrgNamespaceFormatter(1), authlib.OrgNamespaceFormatter(1), "other-key"},
		{"cross-org result", authlib.OrgNamespaceFormatter(1), authlib.OrgNamespaceFormatter(2), "delete-key"},
		{"cross-org request", authlib.OrgNamespaceFormatter(2), authlib.OrgNamespaceFormatter(2), "delete-key"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			storage := grafanarest.NewMockStorage(t)
			if tc.requestNamespace == authlib.OrgNamespaceFormatter(1) {
				snap := dashv0.Snapshot{}
				snap.Name = "snapshot"
				snap.Namespace = tc.storedNamespace
				snap.Spec.DeleteKey = &tc.storedKey
				storage.On("List", mock.Anything, mock.Anything).Return(&dashv0.SnapshotList{Items: []dashv0.Snapshot{snap}}, nil)
			}
			routes := GetRoutes(dashv0.SnapshotSharingOptions{SnapshotsEnabled: true},
				acmock.New().WithPermissions([]ac.Permission{{Action: dashboards.ActionSnapshotsDelete}}),
				map[string]common.OpenAPIDefinition{}, func() rest.Storage { return storage }, dashboards.NewFakeDashboardService(t), nil, testReadFromLegacy)
			req := httptest.NewRequest(http.MethodDelete, "/snapshots/delete/delete-key", nil)
			req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{OrgID: 1, UserID: 1}))
			req = mux.SetURLVars(req, map[string]string{"namespace": tc.requestNamespace, "deleteKey": "delete-key"})
			rsp := httptest.NewRecorder()
			routes.Namespace[1].Handler(rsp, req)
			require.Equal(t, http.StatusNotFound, rsp.Code, rsp.Body.String())
			storage.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		})
	}
}
