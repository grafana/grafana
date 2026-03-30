package testcases

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	collectionsV1 "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/star/starimpl"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// starsTestCase tests the "playlists" ResourceMigration
type starsTestCase struct {
	stars map[apis.User]collectionsV1.StarsResource
}

// NewStarsTestCase creates a test case for the stars migrator
func NewStarsTestCase() ResourceMigratorTestCase {
	return &starsTestCase{
		stars: map[apis.User]collectionsV1.StarsResource{},
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

	users := []apis.User{
		helper.Org1.Admin,
		helper.Org1.Editor,
		helper.OrgB.Admin,
	}

	for _, user := range users {
		userID, err := user.Identity.GetInternalID()
		require.NoError(t, err)

		err = stars.Add(ctx, &star.StarDashboardCommand{
			UserID:       userID,
			OrgID:        user.Identity.GetOrgID(),
			DashboardUID: "dash-1",
		})
		require.NoError(t, err)
		err = stars.Add(ctx, &star.StarDashboardCommand{
			UserID:       userID,
			OrgID:        user.Identity.GetOrgID(),
			DashboardUID: "dash-2",
		})
		require.NoError(t, err)

		res, err := stars.GetByUser(context.Background(), &star.GetUserStarsQuery{
			UserID: userID,
		})
		require.NoError(t, err)
		require.NotNil(t, res)
		require.Len(t, res.UserStars, 2)

		tc.stars[user] = collectionsV1.StarsResource{
			Group: "dashboard.grafana.app",
			Kind:  "Dashboard",
			Names: []string{"dash-1", "dash-2"}, // sorted order
		}
	}

	return true // will exist in mode0
}

func (tc *starsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	for user, expected := range tc.stars {
		namespace := authlib.OrgNamespaceFormatter(user.Identity.GetOrgID())
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      user,
			Namespace: namespace,
			GVR: schema.GroupVersionResource{
				Group:    "collections.grafana.app",
				Version:  "v1alpha1",
				Resource: "stars",
			},
		})

		id := user.Identity.GetIdentifier()
		require.Equal(t, authlib.TypeUser, user.Identity.GetIdentityType())
		ctx := identity.WithRequester(context.Background(), user.Identity)
		found, err := client.Resource.Get(ctx, "user-"+id, v1.GetOptions{})
		if !shouldExist {
			require.Error(t, err, "should not get star for user %s", user)
			continue
		}
		require.NoError(t, err)

		tmp, err := found.MarshalJSON()
		require.NoError(t, err)
		stars := &collectionsV1.Stars{}
		err = json.Unmarshal(tmp, stars)
		require.NoError(t, err)
		require.Len(t, stars.Spec.Resource, 1)
		require.Equal(t, expected, stars.Spec.Resource[0])
	}
}
