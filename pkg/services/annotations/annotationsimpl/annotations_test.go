package annotationsimpl

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	ftestutil "github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol/testutil"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/testutil"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardstore "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/guardian"
	alertingStore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAnnotationListingWithRBAC(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sql := db.InitTestDB(t)

	cfg := setting.NewCfg()
	cfg.AnnotationMaximumTagsLength = 60

	features := featuremgmt.WithFeatures()
	tagService := tagimpl.ProvideService(sql)
	ruleStore := alertingStore.SetupStoreForTesting(t, sql)

	repo := ProvideService(sql, cfg, features, tagService, tracing.InitializeTracerForTest(), ruleStore)

	dashboard1 := testutil.CreateDashboard(t, sql, cfg, features, dashboards.SaveDashboardCommand{
		UserID:   1,
		OrgID:    1,
		IsFolder: false,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "Dashboard 1",
		}),
	})

	_ = testutil.CreateDashboard(t, sql, cfg, features, dashboards.SaveDashboardCommand{
		UserID:   1,
		OrgID:    1,
		IsFolder: false,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "Dashboard 2",
		}),
	})

	var err error

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

	u := &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
	}
	role := testutil.SetupRBACRole(t, sql, u)

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
			u.Permissions = map[int64]map[string][]string{1: tc.permissions}
			testutil.SetupRBACPermission(t, sql, role, u)

			results, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				SignedInUser: u,
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
			Scope:  dashboards.ScopeFoldersAll,
		},
	}
	usr := &user.SignedInUser{
		UserID:      1,
		OrgID:       orgID,
		Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByActionContext(context.Background(), permissions)},
	}

	var role *accesscontrol.Role

	type dashInfo struct {
		UID string
		ID  int64
	}

	allDashboards := make([]dashInfo, 0, folder.MaxNestedFolderDepth+1)
	annotationsTexts := make([]string, 0, folder.MaxNestedFolderDepth+1)

	setupFolderStructure := func() db.DB {
		sql, cfg := db.InitTestDBWithCfg(t)

		// enable nested folders so that the folder table is populated for all the tests
		features := featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders)

		tagService := tagimpl.ProvideService(sql)

		dashStore, err := dashboardstore.ProvideDashboardStore(sql, cfg, features, tagService, quotatest.New(false, nil))
		require.NoError(t, err)

		origNewGuardian := guardian.New
		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanViewValue: true, CanSaveValue: true})
		t.Cleanup(func() {
			guardian.New = origNewGuardian
		})

		ac := acimpl.ProvideAccessControl(features, zanzana.NewNoopClient())
		folderPermissions, err := ftestutil.ProvideFolderPermissions(features, cfg, sql)
		require.NoError(t, err)
		fStore := folderimpl.ProvideStore(sql)
		folderSvc := folderimpl.ProvideService(fStore, ac, bus.ProvideBus(tracing.InitializeTracerForTest()), dashStore,
			folderimpl.ProvideDashboardFolderStore(sql), sql, features, cfg, folderPermissions, supportbundlestest.NewFakeBundleService(), nil, tracing.InitializeTracerForTest())
		cfg.AnnotationMaximumTagsLength = 60

		store := NewXormStore(cfg, log.New("annotation.test"), sql, tagService)

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

			dashboard := testutil.CreateDashboard(t, sql, cfg, features, dashboards.SaveDashboardCommand{
				UserID:   usr.UserID,
				OrgID:    orgID,
				IsFolder: false,
				Dashboard: simplejson.NewFromAny(map[string]any{
					"title": fmt.Sprintf("Dashboard under %s", f.UID),
				}),
				FolderID:  f.ID, // nolint:staticcheck
				FolderUID: f.UID,
			})

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

		role = testutil.SetupRBACRole(t, sql, usr)
		return sql
	}

	sql := setupFolderStructure()

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
			ruleStore := alertingStore.SetupStoreForTesting(t, sql)
			repo := ProvideService(sql, cfg, tc.features, tagimpl.ProvideService(sql), tracing.InitializeTracerForTest(), ruleStore)

			usr.Permissions = map[int64]map[string][]string{1: tc.permissions}
			testutil.SetupRBACPermission(t, sql, role, usr)

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
