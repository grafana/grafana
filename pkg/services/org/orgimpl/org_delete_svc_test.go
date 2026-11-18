package orgimpl

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/client-go/rest"
)

// fakeK8sResourceDeleter records calls for testing.
type fakeK8sResourceDeleter struct {
	DeletedOrgs []int64
	Err         error
}

type deletionRecordingStore struct {
	FakeOrgStore
	deleteFn func(context.Context, *org.DeleteOrgCommand) error
}

func (s *deletionRecordingStore) Delete(ctx context.Context, cmd *org.DeleteOrgCommand) error {
	return s.deleteFn(ctx, cmd)
}

func TestDeletionService_APIThenSQL(t *testing.T) {
	for _, tc := range []struct {
		name       string
		stackID    string
		apiFailure bool
		sqlFailure bool
	}{
		{name: "API cleanup precedes legacy SQL sweep"},
		{name: "API failure preserves SQL org", apiFailure: true},
		{name: "Cloud skips API but retains SQL sweep", stackID: "123"},
		{name: "SQL failure is returned", sqlFailure: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls []string
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls = append(calls, "api")
				if tc.apiFailure {
					w.WriteHeader(http.StatusForbidden)
					return
				}
				w.WriteHeader(http.StatusOK)
			}))
			t.Cleanup(server.Close)
			cfg := setting.NewCfg()
			cfg.StackID = tc.stackID
			dashSvc := dashboards.NewFakeDashboardService(t)
			dashSvc.On("DeleteAllDashboards", mock.Anything, int64(2)).Run(func(args mock.Arguments) {
				ctx := args.Get(0).(context.Context)
				require.True(t, identity.IsServiceIdentity(ctx))
				user, err := identity.GetRequester(ctx)
				require.NoError(t, err)
				require.Equal(t, int64(2), user.GetOrgID())
				calls = append(calls, "dashboards")
			}).Return(nil).Once()
			sqlErr := errors.New("SQL cleanup failed")
			svc := &DeletionService{
				store: &deletionRecordingStore{deleteFn: func(ctx context.Context, cmd *org.DeleteOrgCommand) error {
					require.Equal(t, int64(2), cmd.ID)
					calls = append(calls, "sql")
					if tc.sqlFailure {
						return sqlErr
					}
					return nil
				}},
				ac:      acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
				dashSvc: dashSvc,
				k8sDeleter: newK8sResourceDeleter(cfg, apiserver.RestConfigProviderFunc(func(ctx context.Context) (*rest.Config, error) {
					require.True(t, identity.IsServiceIdentity(ctx))
					return &rest.Config{Host: server.URL}, nil
				}), log.NewNopLogger()),
			}
			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: {accesscontrol.ActionOrgsDelete: {"*"}}},
			})
			err := svc.Delete(ctx, &org.DeleteOrgCommand{ID: 2})
			switch {
			case tc.apiFailure:
				require.ErrorContains(t, err, "failed to delete migrated resources for org 2")
				assert.Equal(t, []string{"dashboards", "api"}, calls)
			case tc.stackID != "":
				require.NoError(t, err)
				assert.Equal(t, []string{"dashboards", "sql"}, calls)
			default:
				if tc.sqlFailure {
					require.ErrorIs(t, err, sqlErr)
				} else {
					require.NoError(t, err)
				}
				assert.Equal(t, []string{"dashboards", "api", "api", "api", "api", "api", "sql"}, calls)
			}
		})
	}
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
