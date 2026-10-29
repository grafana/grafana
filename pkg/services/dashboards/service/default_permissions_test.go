package service

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	dashboardv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permissioncache"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDefaultPermissionsRefreshAfterCommit(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	f := ini.Empty()
	f.Section("rbac").Key("resources_with_managed_permissions_on_creation").SetValue("dashboard,folder")
	cfg, err := setting.NewCfgFromINIFile(f)
	require.NoError(t, err)
	for _, appPlatform := range []bool{false, true} {
		for _, folder := range []bool{false, true} {
			for _, serviceAccount := range []bool{false, true} {
				for _, outcome := range []string{"commit", "rollback", "permission failure"} {
					name := "legacy/"
					if appPlatform {
						name = "App Platform/"
					}
					if folder {
						name += "folder/"
					} else {
						name += "dashboard/"
					}
					if serviceAccount {
						name += "service account/"
					} else {
						name += "user/"
					}
					t.Run(name+outcome, func(t *testing.T) {
						sql := sqlstore.NewTestStore(t, sqlstore.WithoutMigrator())
						requester := &user.SignedInUser{UserID: 7, OrgID: 1, IsServiceAccount: serviceAccount}
						ctx := request.WithNamespace(t.Context(), "default")
						ctx = identity.WithRequester(ctx, requester)
						failure := errors.New("failed")
						var writeErr error
						if outcome == "permission failure" {
							writeErr = failure
						}
						permissions := acmock.NewMockedPermissionsService()
						permissions.On("SetPermissions", mock.Anything, int64(1), "new", mock.Anything).Return([]accesscontrol.ResourcePermission{}, writeErr).Once()
						calls := 0
						ac := creatorRefreshService{get: func(ctx context.Context, actor identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
							require.False(t, sqlstore.IsInTransaction(ctx))
							require.Same(t, requester, actor)
							require.True(t, options.ReloadCache)
							calls++
							return nil, nil
						}}
						svc := &DashboardServiceImpl{
							cfg: cfg, log: log.NewNopLogger(), acService: ac,
							permissionCache:   permissioncache.ProvideService(sql, ac),
							folderPermissions: permissions, dashboardPermissionsReady: make(chan struct{}),
						}
						svc.RegisterDashboardPermissions(permissions)
						err := sql.InTransaction(ctx, func(ctx context.Context) error {
							require.NoError(t, sql.InTransaction(ctx, func(ctx context.Context) error {
								if appPlatform {
									obj := &dashboardv0.Dashboard{}
									obj.SetName("new")
									meta, err := utils.MetaAccessor(obj)
									require.NoError(t, err)
									kind := "dashboards"
									if folder {
										kind = "folders"
									}
									err = svc.SetDefaultPermissionsAfterCreate(ctx, &resourcepb.ResourceKey{Resource: kind}, requester, meta)
									require.ErrorIs(t, err, writeErr)
								} else {
									svc.SetDefaultPermissions(ctx, &dashboards.SaveDashboardDTO{OrgID: 1, User: requester}, &dashboards.Dashboard{UID: "new", IsFolder: folder}, false)
								}
								return nil
							}))
							require.Zero(t, calls)
							if outcome == "rollback" {
								return failure
							}
							return nil
						})
						if outcome == "rollback" {
							require.ErrorIs(t, err, failure)
						} else {
							require.NoError(t, err)
						}
						if outcome == "commit" {
							require.Equal(t, 1, calls)
						} else {
							require.Zero(t, calls)
						}
						permissions.AssertExpectations(t)
					})
				}
			}
		}
	}
}

type creatorRefreshService struct {
	accesscontrol.Service
	get func(context.Context, identity.Requester, accesscontrol.Options) ([]accesscontrol.Permission, error)
}

func (s creatorRefreshService) GetUserPermissions(ctx context.Context, requester identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	return s.get(ctx, requester, options)
}
