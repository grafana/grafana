package testcases

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	collectionsV1 "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/star/starimpl"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// starsTestCase tests the "playlists" ResourceMigration
type starsTestCase struct {
	stars map[string]collectionsV1.StarsResource
}

// NewStarsTestCase creates a test case for the stars migrator
func NewStarsTestCase() ResourceMigratorTestCase {
	return &starsTestCase{
		stars: map[string]collectionsV1.StarsResource{},
	}
}

func (tc *starsTestCase) Name() string {
	return "stars"
}

func (tc *starsTestCase) FeatureToggles() []string {
	return nil
}

func (tc *starsTestCase) RenameTables() []string {
	return []string{}
}

func (tc *starsTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		{
			Group:    "collections.grafana.app",
			Version:  "v1alpha1",
			Resource: "stars",
		},
	}
}

func (tc *starsTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// none
}

func (tc *starsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	env := helper.GetEnv()

	ctx := context.Background()
	stars := starimpl.ProvideService(env.SQLStore)
	userID, err := helper.Org1.Admin.Identity.GetInternalID()
	require.NoError(t, err)

	err = stars.Add(ctx, &star.StarDashboardCommand{
		UserID:       userID,
		OrgID:        helper.Org1.OrgID,
		DashboardUID: "dash-1",
	})
	require.NoError(t, err)
	err = stars.Add(ctx, &star.StarDashboardCommand{
		UserID:       userID,
		OrgID:        helper.Org1.OrgID,
		DashboardUID: "dash-2",
	})
	require.NoError(t, err)

	res, err := stars.GetByUser(context.Background(), &star.GetUserStarsQuery{
		UserID: userID,
	})
	require.NoError(t, err)
	require.NotNil(t, res)
	require.Len(t, res.UserStars, 2)

	tc.stars = map[string]collectionsV1.StarsResource{
		"user-" + helper.Org1.Admin.Identity.GetUID(): {
			Group: "dashboard.grafana.app",
			Kind:  "Dashboard",
			Names: []string{"dash-1", "dash-2"},
		},
	}

	return true // will exist in mode0
}

func (tc *starsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	orgID := helper.Org1.OrgID
	namespace := authlib.OrgNamespaceFormatter(orgID)

	// Verify playlists
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "collections.grafana.app",
			Version:  "v1alpha1",
			Resource: "stars",
		},
	})

	for user, expected := range tc.stars {
		found, err := client.Resource.Get(context.Background(), user, v1.GetOptions{})
		require.NoError(t, err)

		tmp, err := found.MarshalJSON()
		require.NoError(t, err)
		typedobj := &collectionsV1.Stars{}
		err = json.Unmarshal(tmp, typedobj)
		require.NoError(t, err)
		require.Len(t, typedobj.Spec.Resource, 1)
		require.Equal(t, expected, typedobj.Spec.Resource[0])
	}
}
