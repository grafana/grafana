package orgimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

// fakeK8sResourceDeleter records calls for testing.
type fakeK8sResourceDeleter struct {
	DeletedOrgs []int64
	Err         error
}

func (f *fakeK8sResourceDeleter) deleteCollections(_ context.Context, orgID int64) error {
	f.DeletedOrgs = append(f.DeletedOrgs, orgID)
	return f.Err
}

func newFakeK8sResourceDeleter() *fakeK8sResourceDeleter {
	return &fakeK8sResourceDeleter{}
}

func TestDeletionService_Delete(t *testing.T) {
	store := &FakeOrgStore{}
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	dashSvc := dashboards.NewFakeDashboardService(t)
	k8sDeleter := newFakeK8sResourceDeleter()
	svc := &DeletionService{
		store:      store,
		cfg:        setting.NewCfg(),
		dashSvc:    dashSvc,
		ac:         ac,
		k8sDeleter: k8sDeleter,
	}

	// if a user has access to delete orgs, then the dashboards should be deleted with a service identity
	requester := &identity.StaticRequester{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				accesscontrol.ActionOrgsDelete: {"*"},
			},
			2: {
				accesscontrol.ActionOrgsDelete: {"*"},
			},
		},
	}
	dashSvc.On("DeleteAllDashboards", mock.MatchedBy(func(ctx context.Context) bool {
		return identity.IsServiceIdentity(ctx)
	}), int64(2)).Return(nil).Once()
	ctx := context.Background()
	ctx = identity.WithRequester(ctx, requester)
	err := svc.Delete(ctx, &org.DeleteOrgCommand{ID: 2})
	require.NoError(t, err)
	dashSvc.AssertExpectations(t)

	// Verify the k8s deleter was called for the org
	require.Equal(t, []int64{2}, k8sDeleter.DeletedOrgs)

	// when k8s deleter returns an error, Delete propagates it
	k8sDeleter.Err = errors.New("API server unavailable")
	dashSvc.On("DeleteAllDashboards", mock.MatchedBy(func(ctx context.Context) bool {
		return identity.IsServiceIdentity(ctx)
	}), int64(3)).Return(nil).Once()
	ctx = context.Background()
	ctx = identity.WithRequester(ctx, requester)
	err = svc.Delete(ctx, &org.DeleteOrgCommand{ID: 3})
	require.Error(t, err)
	require.ErrorContains(t, err, "failed to delete migrated resources for org 3")
	require.ErrorContains(t, err, "API server unavailable")
	k8sDeleter.Err = nil

	// if a user does not have access to delete orgs, then the dashboards should not be deleted
	requester = &identity.StaticRequester{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				accesscontrol.ActionOrgsRead: {"*"},
			},
			2: {
				accesscontrol.ActionOrgsRead: {"*"},
			},
		},
	}
	ctx = context.Background()
	ctx = identity.WithRequester(ctx, requester)
	err = svc.Delete(ctx, &org.DeleteOrgCommand{ID: 2})
	require.Error(t, err)
}
