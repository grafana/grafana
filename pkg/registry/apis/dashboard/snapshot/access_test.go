package snapshot

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"
	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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

func TestSnapshotLegacyStore_Delete_MirrorsLegacyPolicy(t *testing.T) {
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
			dashboard:   simplejson.NewFromAny(map[string]any{"uid": "secret-dash"}),
			ac:          actest.FakeAccessControl{ExpectedEvaluate: false},
			wantAllowed: false,
		},
		{
			name:        "non-owner without write on the source dashboard is denied by numeric id",
			userID:      otherEditorID,
			dashboard:   simplejson.NewFromAny(map[string]any{"id": 42}),
			ac:          actest.FakeAccessControl{ExpectedEvaluate: false},
			wantAllowed: false,
		},
		{
			name:        "non-owner with write on the source dashboard is allowed",
			userID:      otherEditorID,
			dashboard:   simplejson.NewFromAny(map[string]any{"uid": "secret-dash"}),
			ac:          actest.FakeAccessControl{ExpectedEvaluate: true},
			wantAllowed: true,
		},
		{
			name:        "owner is allowed without write on the source dashboard",
			userID:      snapshotCreatorID,
			dashboard:   simplejson.NewFromAny(map[string]any{"uid": "secret-dash"}),
			ac:          actest.FakeAccessControl{ExpectedEvaluate: false},
			wantAllowed: true,
		},
		{
			name:        "snapshot without a source dashboard is allowed",
			userID:      otherEditorID,
			dashboard:   nil,
			ac:          actest.FakeAccessControl{ExpectedEvaluate: false},
			wantAllowed: true,
		},
		{
			name:        "deleted source dashboard is allowed",
			userID:      otherEditorID,
			dashboard:   simplejson.NewFromAny(map[string]any{"uid": "gone-dash"}),
			ac:          actest.FakeAccessControl{ExpectedErr: dashboards.ErrDashboardNotFound},
			wantAllowed: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := dashboardsnapshots.NewMockService(t)
			svc.On("GetDashboardSnapshot", mock.Anything, mock.Anything).
				Return(&dashboardsnapshots.DashboardSnapshot{
					Key:       "snap-1",
					DeleteKey: "abc123",
					OrgID:     1,
					UserID:    snapshotCreatorID,
					Dashboard: tt.dashboard,
				}, nil)
			if tt.wantAllowed {
				svc.On("DeleteDashboardSnapshot", mock.Anything, mock.Anything).Return(nil).Once()
			}
			store := &SnapshotLegacyStore{
				ResourceInfo:  dashV0.SnapshotResourceInfo,
				Service:       svc,
				AccessControl: tt.ac,
			}

			_, deleted, err := store.Delete(ctxForUser(1, tt.userID), "snap-1", nil, &metav1.DeleteOptions{})
			if tt.wantAllowed {
				require.NoError(t, err)
				require.True(t, deleted)
				return
			}
			require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
			require.False(t, deleted)
		})
	}
}
