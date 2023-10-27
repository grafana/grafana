package annotationsimpl

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardstore "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegrationAnnotationListingWithRBAC(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sql := db.InitTestDB(t)

	cfg := setting.NewCfg()
	cfg.AnnotationMaximumTagsLength = 60

	features := featuremgmt.WithFeatures()
	tagService := tagimpl.ProvideService(sql, sql.Cfg)
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := dashboardstore.ProvideDashboardStore(sql, sql.Cfg, features, tagService, quotaService)

	repo := ProvideService(
		sql,
		cfg,
		features,
		tagService,
	)

	require.NoError(t, err)

	testDashboard1 := dashboards.SaveDashboardCommand{
		UserID:   1,
		OrgID:    1,
		IsFolder: false,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "Dashboard 1",
		}),
	}
	dashboard1, err := dashboardStore.SaveDashboard(context.Background(), testDashboard1)
	require.NoError(t, err)

	testDashboard2 := dashboards.SaveDashboardCommand{
		UserID: 1,
		OrgID:  1,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "Dashboard 2",
		}),
	}
	_, err = dashboardStore.SaveDashboard(context.Background(), testDashboard2)
	require.NoError(t, err)

	dash1Annotation := &annotations.Item{
		OrgID:       1,
		DashboardID: 1,
		Epoch:       10,
	}
	err = repo.Save(context.Background(), dash1Annotation)
	require.NoError(t, err)

	dash2Annotation := &annotations.Item{
		OrgID:       1,
		DashboardID: 2,
		Epoch:       10,
		Tags:        []string{"foo:bar"},
	}
	err = repo.Save(context.Background(), dash2Annotation)
	require.NoError(t, err)

	organizationAnnotation := &annotations.Item{
		OrgID: 1,
		Epoch: 10,
	}
	err = repo.Save(context.Background(), organizationAnnotation)
	require.NoError(t, err)

	user := &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
	}
	role := setupRBACRole(t, sql, user)

	type testStruct struct {
		description           string
		permissions           map[string][]string
		expectedAnnotationIds []int64
		expectedError         bool
	}

	testCases := []testStruct{
		{
			description: "Should find all annotations when has permissions to list all annotations and read all dashboards",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsAll},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedAnnotationIds: []int64{dash1Annotation.ID, dash2Annotation.ID, organizationAnnotation.ID},
		},
		{
			description: "Should find all dashboard annotations",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedAnnotationIds: []int64{dash1Annotation.ID, dash2Annotation.ID},
		},
		{
			description: "Should find only annotations from dashboards that user can read",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {fmt.Sprintf("dashboards:uid:%s", dashboard1.UID)},
			},
			expectedAnnotationIds: []int64{dash1Annotation.ID},
		},
		{
			description: "Should find no annotations if user can't view dashboards or organization annotations",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
			},
			expectedAnnotationIds: []int64{},
		},
		{
			description: "Should find only organization annotations",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeOrganization},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedAnnotationIds: []int64{organizationAnnotation.ID},
		},
		{
			description: "Should error if user doesn't have annotation read permissions",
			permissions: map[string][]string{
				dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsAll},
			},
			expectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			user.Permissions = map[int64]map[string][]string{1: tc.permissions}
			setupRBACPermission(t, sql, role, user)

			results, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				SignedInUser: user,
			})
			if tc.expectedError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Len(t, results, len(tc.expectedAnnotationIds))
			for _, r := range results {
				assert.Contains(t, tc.expectedAnnotationIds, r.ID)
			}
		})
	}
}

func TestIntegrationAnnotationListingWithInheritedRBAC(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	orgID := int64(1)
	permissions := []accesscontrol.Permission{
		{
			Action: dashboards.ActionFoldersCreate,
		}, {
			Action: dashboards.ActionFoldersWrite,
			Scope:  dashboards.ScopeFoldersAll,
		},
	}
	usr := &user.SignedInUser{
		UserID:      1,
		OrgID:       orgID,
		Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByAction(permissions)},
	}

	var role *accesscontrol.Role

	type dashInfo struct {
		UID string
		ID  int64
	}

	allDashboards := make([]dashInfo, 0, folder.MaxNestedFolderDepth+1)
	annotationsTexts := make([]string, 0, folder.MaxNestedFolderDepth+1)

	setupFolderStructure := func() *sqlstore.SQLStore {
		db := db.InitTestDB(t)

		// enable nested folders so that the folder table is populated for all the tests
		features := featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders)

		tagService := tagimpl.ProvideService(db, db.Cfg)

		quotaService := quotatest.New(false, nil)

		dashStore, err := dashboardstore.ProvideDashboardStore(db, db.Cfg, features, tagService, quotaService)
		require.NoError(t, err)

		origNewGuardian := guardian.New
		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanViewValue: true, CanSaveValue: true})
		t.Cleanup(func() {
			guardian.New = origNewGuardian
		})

		folderSvc := folderimpl.ProvideService(mock.New(), bus.ProvideBus(tracing.InitializeTracerForTest()), db.Cfg, dashStore, folderimpl.ProvideDashboardFolderStore(db), db, features)

		cfg := setting.NewCfg()
		cfg.AnnotationMaximumTagsLength = 60

		store := NewXormStore(cfg, log.New("annotation.test"), db, tagService)

		parentUID := ""
		for i := 0; ; i++ {
			uid := fmt.Sprintf("f%d", i)
			f, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				UID:          uid,
				OrgID:        orgID,
				Title:        uid,
				SignedInUser: usr,
				ParentUID:    parentUID,
			})
			if err != nil {
				if errors.Is(err, folder.ErrMaximumDepthReached) {
					break
				}

				t.Log("unexpected error", "error", err)
				t.Fail()
			}

			dashInFolder := dashboards.SaveDashboardCommand{
				UserID:   usr.UserID,
				OrgID:    orgID,
				IsFolder: false,
				Dashboard: simplejson.NewFromAny(map[string]any{
					"title": fmt.Sprintf("Dashboard under %s", f.UID),
				}),
				FolderID:  f.ID,
				FolderUID: f.UID,
			}
			dashboard, err := dashStore.SaveDashboard(context.Background(), dashInFolder)
			require.NoError(t, err)

			allDashboards = append(allDashboards, dashInfo{UID: dashboard.UID, ID: dashboard.ID})

			parentUID = f.UID

			annotationTxt := fmt.Sprintf("annotation %d", i)
			dash1Annotation := &annotations.Item{
				OrgID:       orgID,
				DashboardID: dashboard.ID,
				Epoch:       10,
				Text:        annotationTxt,
			}
			err = store.Add(context.Background(), dash1Annotation)
			require.NoError(t, err)

			annotationsTexts = append(annotationsTexts, annotationTxt)
		}

		role = setupRBACRole(t, db, usr)
		return db
	}

	db := setupFolderStructure()

	testCases := []struct {
		desc                   string
		features               featuremgmt.FeatureToggles
		permissions            map[string][]string
		expectedAnnotationText []string
		expectedError          bool
	}{
		{
			desc:     "Should find only annotations from dashboards under folders that user can read",
			features: featuremgmt.WithFeatures(),
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {"folders:uid:f0"},
			},
			expectedAnnotationText: annotationsTexts[:1],
		},
		{
			desc:     "Should find only annotations from dashboards under inherited folders if nested folder are enabled",
			features: featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {"folders:uid:f0"},
			},
			expectedAnnotationText: annotationsTexts[:],
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.AnnotationMaximumTagsLength = 60

			repo := ProvideService(db, cfg, tc.features, tagimpl.ProvideService(db, db.Cfg))

			usr.Permissions = map[int64]map[string][]string{1: tc.permissions}
			setupRBACPermission(t, db, role, usr)

			results, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				SignedInUser: usr,
			})
			if tc.expectedError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Len(t, results, len(tc.expectedAnnotationText))
			for _, r := range results {
				assert.Contains(t, tc.expectedAnnotationText, r.Text)
			}
		})
	}
}

func setupRBACRole(t *testing.T, db *sqlstore.SQLStore, user *user.SignedInUser) *accesscontrol.Role {
	t.Helper()
	var role *accesscontrol.Role
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		role = &accesscontrol.Role{
			OrgID:   user.OrgID,
			UID:     "test_role",
			Name:    "test:role",
			Updated: time.Now(),
			Created: time.Now(),
		}
		_, err := sess.Insert(role)
		if err != nil {
			return err
		}

		_, err = sess.Insert(accesscontrol.UserRole{
			OrgID:   role.OrgID,
			RoleID:  role.ID,
			UserID:  user.UserID,
			Created: time.Now(),
		})
		if err != nil {
			return err
		}
		return nil
	})

	require.NoError(t, err)
	return role
}

func setupRBACPermission(t *testing.T, db *sqlstore.SQLStore, role *accesscontrol.Role, user *user.SignedInUser) {
	t.Helper()
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if _, err := sess.Exec("DELETE FROM permission WHERE role_id = ?", role.ID); err != nil {
			return err
		}

		var acPermission []accesscontrol.Permission
		for action, scopes := range user.Permissions[user.OrgID] {
			for _, scope := range scopes {
				acPermission = append(acPermission, accesscontrol.Permission{
					RoleID: role.ID, Action: action, Scope: scope, Created: time.Now(), Updated: time.Now(),
				})
			}
		}

		if _, err := sess.InsertMulti(&acPermission); err != nil {
			return err
		}

		return nil
	})

	require.NoError(t, err)
}
