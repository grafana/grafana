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
type preferencesTestCase struct {
	preferenceUIDs []string
}

// NewPreferencesTestCase creates a test case for the preferences migrator
func NewPreferencesTestCase() ResourceMigratorTestCase {
	return &preferencesTestCase{}
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

	users := []apis.User{
		helper.Org1.Admin,
		helper.Org1.Editor,
	}

	for _, user := range users {
		userID, err := user.Identity.GetInternalID()
		require.NoError(t, err)

		err = service.Save(ctx, &pref.SavePreferenceCommand{
			UserID:   userID,
			OrgID:    helper.Org1.OrgID,
			Language: "lang1",
		})
		require.NoError(t, err)

		tc.preferenceUIDs = append(tc.preferenceUIDs, "user-"+user.Identity.GetRawIdentifier())
	}

	err := service.Save(ctx, &pref.SavePreferenceCommand{
		OrgID:    helper.Org1.OrgID,
		Language: "lang2",
	})
	require.NoError(t, err)
	tc.preferenceUIDs = append(tc.preferenceUIDs, "namespace") // the org settings

	return true // will exist in mode0
}

func (tc *preferencesTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	expectedCount := 0
	if shouldExist {
		expectedCount = len(tc.preferenceUIDs)
	}

	orgID := helper.Org1.OrgID
	namespace := authlib.OrgNamespaceFormatter(orgID)

	// Verify results
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    preferencesV1.APIGroup,
			Version:  preferencesV1.APIVersion,
			Resource: "preferences",
		},
	})

	verifyResourceCount(t, client, expectedCount)
	for _, uid := range tc.preferenceUIDs {
		verifyResource(t, client, uid, shouldExist)
	}
}
