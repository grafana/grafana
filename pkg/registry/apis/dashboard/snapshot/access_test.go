package snapshot

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

func ctxForUser(orgID, userID int64) context.Context {
	return identity.WithRequester(ctxForOrg(orgID), &identity.StaticRequester{
		Type:    authlib.TypeUser,
		UserID:  userID,
		UserUID: fmt.Sprintf("user-uid-%d", userID),
		OrgID:   orgID,
	})
}

const (
	snapshotCreatorID = int64(1)
	otherEditorID     = int64(2)
)

func newSnapshotStore(t *testing.T, dashboard *simplejson.Json, expectDelete bool) *SnapshotLegacyStore {
	t.Helper()
	svc := dashboardsnapshots.NewMockService(t)
	svc.On("GetDashboardSnapshot", mock.Anything, mock.Anything).
		Return(&dashboardsnapshots.DashboardSnapshot{
			Key:       "snap-1",
			DeleteKey: "secret-delete-key",
			OrgID:     1,
			UserID:    snapshotCreatorID,
			Dashboard: dashboard,
		}, nil)
	if expectDelete {
		svc.On("DeleteDashboardSnapshot", mock.Anything, mock.Anything).Return(nil).Once()
	}
	return &SnapshotLegacyStore{
		ResourceInfo: dashv0.SnapshotResourceInfo,
		Service:      svc,
		Namespacer:   authlib.OrgNamespaceFormatter,
	}
}

func dashboardJSON(uid string) *simplejson.Json {
	return simplejson.NewFromAny(map[string]any{"uid": uid})
}

func TestSnapshotDelete_MirrorsLegacyPolicy(t *testing.T) {
	tests := []struct {
		name        string
		userID      int64
		dashboard   *simplejson.Json
		ac          actest.FakeAccessControl
		wantAllowed bool
	}{
		{
			name:        "non-owner without write on the source dashboard is denied",
			userID:      otherEditorID,
			dashboard:   dashboardJSON("secret-dash"),
			ac:          actest.FakeAccessControl{ExpectedEvaluate: false},
			wantAllowed: false,
		},
		{
			name:        "non-owner with write on the source dashboard is allowed",
			userID:      otherEditorID,
			dashboard:   dashboardJSON("secret-dash"),
			ac:          actest.FakeAccessControl{ExpectedEvaluate: true},
			wantAllowed: true,
		},
		{
			name:        "owner is allowed without write on the source dashboard",
			userID:      snapshotCreatorID,
			dashboard:   dashboardJSON("secret-dash"),
			ac:          actest.FakeAccessControl{ExpectedEvaluate: false},
			wantAllowed: true,
		},
		{
			name:        "snapshot without a source dashboard is allowed",
			userID:      otherEditorID,
			dashboard:   simplejson.New(),
			ac:          actest.FakeAccessControl{ExpectedEvaluate: false},
			wantAllowed: true,
		},
		{
			name:        "deleted source dashboard is allowed",
			userID:      otherEditorID,
			dashboard:   dashboardJSON("gone-dash"),
			ac:          actest.FakeAccessControl{ExpectedErr: dashboards.ErrDashboardNotFound},
			wantAllowed: true,
		},
	}

	for _, tt := range tests {
		t.Run("DELETE: "+tt.name, func(t *testing.T) {
			store := newSnapshotStore(t, tt.dashboard, tt.wantAllowed)
			wrapper := NewStorageWrapper(store, dashv0.SnapshotSharingOptions{}, tt.ac)

			_, deleted, err := wrapper.(*storageWrapper).Delete(ctxForUser(1, tt.userID), "snap-1", nil, &metav1.DeleteOptions{})
			if tt.wantAllowed {
				require.NoError(t, err)
				require.True(t, deleted)
				return
			}
			require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
			require.False(t, deleted)
		})

		t.Run("deletekey: "+tt.name, func(t *testing.T) {
			store := newSnapshotStore(t, tt.dashboard, false)
			r, err := NewDeleteKeyREST(store, tt.ac)
			require.NoError(t, err)

			responder := &capturingResponder{}
			handler, err := r.(*deleteKeyREST).Connect(ctxForUser(1, tt.userID), "snap-1", nil, responder)
			if !tt.wantAllowed {
				require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
				require.Nil(t, handler)
				return
			}
			require.NoError(t, err)
			handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
			result, ok := responder.obj.(*dashv0.DashboardSnapshotWithDeleteKey)
			require.True(t, ok)
			require.Equal(t, "secret-delete-key", result.DeleteKey)
		})
	}
}

// Snapshot keys are looked up globally, so a caller must not learn from the status
// code whether a key exists in another org, regardless of their dashboard permissions.
func TestSnapshotDelete_CrossOrgReturnsNotFound(t *testing.T) {
	for _, canWrite := range []bool{false, true} {
		ac := actest.FakeAccessControl{ExpectedEvaluate: canWrite}
		callerInOrg2 := ctxForUser(2, otherEditorID)

		t.Run(fmt.Sprintf("DELETE (dashboards:write=%v)", canWrite), func(t *testing.T) {
			wrapper := NewStorageWrapper(newSnapshotStore(t, dashboardJSON("secret-dash"), false), dashv0.SnapshotSharingOptions{}, ac)

			_, deleted, err := wrapper.(*storageWrapper).Delete(callerInOrg2, "snap-1", nil, &metav1.DeleteOptions{})
			require.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
			require.False(t, deleted)
		})

		t.Run(fmt.Sprintf("deletekey (dashboards:write=%v)", canWrite), func(t *testing.T) {
			r, err := NewDeleteKeyREST(newSnapshotStore(t, dashboardJSON("secret-dash"), false), ac)
			require.NoError(t, err)

			handler, err := r.(*deleteKeyREST).Connect(callerInOrg2, "snap-1", nil, &capturingResponder{})
			require.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
			require.Nil(t, handler)
		})
	}
}

func TestSnapshotOwnedBy_UnifiedStorageAnnotation(t *testing.T) {
	requester := &identity.StaticRequester{Type: authlib.TypeUser, UserID: otherEditorID, UserUID: "user-uid-2", OrgID: 1}

	snap := &dashv0.Snapshot{}
	snap.Annotations = map[string]string{utils.AnnoKeyCreatedBy: requester.GetUID()}
	require.True(t, snapshotOwnedBy(snap, requester))

	snap.Annotations = map[string]string{utils.AnnoKeyCreatedBy: "user:someone-else"}
	require.False(t, snapshotOwnedBy(snap, requester))
}
