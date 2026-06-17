package testcases

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	preferencesV1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/prefimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// preferencesTestCase tests the "preferences" ResourceMigration
type preferencesTestCase struct{}

// NewPreferencesTestCase creates a test case for the preferences migrator
func NewPreferencesTestCase() ResourceMigratorTestCase {
	return &preferencesTestCase{}
}

// testUsers returns the users that the preferences testcase exercises.
func (tc *preferencesTestCase) testUsers(helper *apis.K8sTestHelper) []apis.User {
	return []apis.User{
		helper.Org1.Admin,
		helper.Org1.Editor,
		helper.OrgB.Admin,
	}
}

func (tc *preferencesTestCase) Name() string {
	return "preferences"
}

func (tc *preferencesTestCase) FeatureToggles() []string {
	return nil
}

func (tc *preferencesTestCase) RenameTables() []string {
	return []string{}
}

func (tc *preferencesTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		preferencesV1.GroupVersion.WithResource("preferences"),
	}
}

func (tc *preferencesTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// none
}

func (tc *preferencesTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	env := helper.GetEnv()

	ctx := context.Background()
	service := prefimpl.ProvideService(env.SQLStore, setting.NewCfg())

	// Track unique orgs so we can save a namespace preference for each.
	seenOrgs := map[int64]bool{}

	for _, user := range tc.testUsers(helper) {
		orgID := user.Identity.GetOrgID()
		userID, err := user.Identity.GetInternalID()
		require.NoError(t, err)

		// Use the user's own OrgID — OrgB.Admin is in a different org from
		// the Org1 users, so the verify step looks them up under their own org.
		err = service.Save(ctx, &pref.SavePreferenceCommand{
			UserID:   userID,
			OrgID:    orgID,
			Language: "user",
		})
		require.NoError(t, err)

		if !seenOrgs[orgID] {
			err := service.Save(ctx, &pref.SavePreferenceCommand{
				OrgID:    orgID,
				Language: "org",
			})
			require.NoError(t, err)
			seenOrgs[orgID] = true
		}
	}

	return true // will exist in mode0
}

func (tc *preferencesTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	// Each user should be able to read their own preferences and namespace.
	// The authorizer only allows a user to read their own "user-<uid>"
	// preference, so we use each user's own client.
	for _, user := range tc.testUsers(helper) {
		orgID := user.Identity.GetOrgID()
		namespace := authlib.OrgNamespaceFormatter(orgID)

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      user,
			Namespace: namespace,
			GVR: schema.GroupVersionResource{
				Group:    preferencesV1.APIGroup,
				Version:  preferencesV1.APIVersion,
				Resource: "preferences",
			},
		})
		verifyResource(t, client, "user-"+user.Identity.GetRawIdentifier(), shouldExist)

		// The user can see namespace properties
		verifyResource(t, client, "namespace", shouldExist)
	}
}
